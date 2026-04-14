use crate::{diff, git, state, theme};
use anyhow::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Wrap},
    Frame, Terminal,
};
use std::io;

struct App {
    range: String,
    branch: String,
    stats: git::DiffStats,
    files: Vec<diff::DiffFile>,
    state: state::ReviewState,
    current_file_index: usize,
    left_scroll: u16,
    right_scroll: u16,
    show_file_list: bool,
    file_list_state: ListState,
}

impl App {
    fn new(
        range: &str,
        branch: &str,
        stats: git::DiffStats,
        files: Vec<diff::DiffFile>,
        state: state::ReviewState,
    ) -> Self {
        let mut file_list_state = ListState::default();
        file_list_state.select(Some(0));

        Self {
            range: range.to_string(),
            branch: branch.to_string(),
            stats,
            files,
            state,
            current_file_index: 0,
            left_scroll: 0,
            right_scroll: 0,
            show_file_list: false,
            file_list_state,
        }
    }

    fn current_file(&self) -> &diff::DiffFile {
        &self.files[self.current_file_index]
    }

    fn toggle_review(&mut self) {
        let path = self.current_file().path.clone();
        if let Some(file_state) = self.state.files.get_mut(&path) {
            file_state.reviewed = !file_state.reviewed;
        }
    }

    fn next_file(&mut self) {
        if self.current_file_index < self.files.len() - 1 {
            // Save scroll position
            let path = self.current_file().path.clone();
            if let Some(file_state) = self.state.files.get_mut(&path) {
                file_state.last_position = self.left_scroll;
            }

            self.current_file_index += 1;
            self.restore_scroll_position();
            self.file_list_state.select(Some(self.current_file_index));
        }
    }

    fn prev_file(&mut self) {
        if self.current_file_index > 0 {
            // Save scroll position
            let path = self.current_file().path.clone();
            if let Some(file_state) = self.state.files.get_mut(&path) {
                file_state.last_position = self.left_scroll;
            }

            self.current_file_index -= 1;
            self.restore_scroll_position();
            self.file_list_state.select(Some(self.current_file_index));
        }
    }

    fn restore_scroll_position(&mut self) {
        let path = self.current_file().path.clone();
        if let Some(file_state) = self.state.files.get(&path) {
            self.left_scroll = file_state.last_position;
            self.right_scroll = file_state.last_position;
        } else {
            self.left_scroll = 0;
            self.right_scroll = 0;
        }
    }

    fn scroll_up(&mut self, amount: u16) {
        self.left_scroll = self.left_scroll.saturating_sub(amount);
        self.right_scroll = self.right_scroll.saturating_sub(amount);
    }

    fn scroll_down(&mut self, amount: u16) {
        self.left_scroll = self.left_scroll.saturating_add(amount);
        self.right_scroll = self.right_scroll.saturating_add(amount);
    }
}

pub fn run(
    range: &str,
    branch: &str,
    stats: git::DiffStats,
    files: Vec<diff::DiffFile>,
    state: &mut state::ReviewState,
) -> Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app state
    let mut app = App::new(range, branch, stats, files, state.clone());
    app.restore_scroll_position();

    // Run app
    let res = run_app(&mut terminal, &mut app);

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    // Copy state back
    *state = app.state;

    res
}

fn run_app<B: ratatui::backend::Backend>(
    terminal: &mut Terminal<B>,
    app: &mut App,
) -> Result<()> {
    loop {
        terminal.draw(|f| ui(f, app))?;

        if let Event::Key(key) = event::read()? {
            match key.code {
                KeyCode::Char('q') | KeyCode::Esc => return Ok(()),
                KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    return Ok(())
                }
                KeyCode::Char('r') => app.toggle_review(),
                KeyCode::Char('n') => app.next_file(),
                KeyCode::Char('p') => app.prev_file(),
                KeyCode::Char('f') => app.show_file_list = !app.show_file_list,
                KeyCode::Char('j') | KeyCode::Down => app.scroll_down(1),
                KeyCode::Char('k') | KeyCode::Up => app.scroll_up(1),
                KeyCode::Char('d') => app.scroll_down(10),
                KeyCode::Char('u') => app.scroll_up(10),
                KeyCode::Char('g') => {
                    app.left_scroll = 0;
                    app.right_scroll = 0;
                }
                KeyCode::Char('G') => {
                    app.left_scroll = u16::MAX;
                    app.right_scroll = u16::MAX;
                }
                KeyCode::Enter if app.show_file_list => {
                    if let Some(selected) = app.file_list_state.selected() {
                        app.current_file_index = selected;
                        app.restore_scroll_position();
                        app.show_file_list = false;
                    }
                }
                _ => {}
            }
        }
    }
}

fn ui(f: &mut Frame, app: &App) {
    let size = f.area();

    // Create layout
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header
            Constraint::Min(0),    // Content
            Constraint::Length(1), // Status bar
        ])
        .split(size);

    // Render header
    render_header(f, app, chunks[0]);

    // Render content (diff or file list)
    if app.show_file_list {
        render_with_file_list(f, app, chunks[1]);
    } else {
        render_diff_split(f, app, chunks[1]);
    }

    // Render status bar
    render_status_bar(f, chunks[2]);
}

fn render_header(f: &mut Frame, app: &App, area: Rect) {
    let current_file = app.current_file();
    let path = &current_file.path;
    let reviewed = app
        .state
        .files
        .get(path)
        .map(|s| s.reviewed)
        .unwrap_or(false);
    let reviewed_icon = if reviewed { "✓" } else { "○" };
    let reviewed_count = app.state.get_reviewed_count();

    let line1 = format!(
        "{} │ {} │ {} files │ {} reviewed ✓ │ +{} -{}",
        app.range, app.branch, app.stats.files_changed, reviewed_count, app.stats.insertions, app.stats.deletions
    );

    let line2 = format!(
        "[{}/{}] {} {}",
        app.current_file_index + 1,
        app.files.len(),
        reviewed_icon,
        path
    );

    let header = Paragraph::new(vec![
        Line::from(Span::styled(line1, theme::header_style())),
        Line::from(Span::styled(line2, theme::header_style())),
    ])
    .style(theme::header_style())
    .block(Block::default().borders(Borders::TOP | Borders::BOTTOM));

    f.render_widget(header, area);
}

fn render_diff_split(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    let file = app.current_file();

    // Build left and right content
    let (left_lines, right_lines) = build_diff_lines(file);

    // Left pane (old/removed)
    let left_text = Paragraph::new(left_lines)
        .style(theme::default_style())
        .scroll((app.left_scroll, 0))
        .wrap(Wrap { trim: false });

    // Right pane (new/added)
    let right_text = Paragraph::new(right_lines)
        .style(theme::default_style())
        .scroll((app.right_scroll, 0))
        .wrap(Wrap { trim: false });

    f.render_widget(left_text, chunks[0]);
    f.render_widget(right_text, chunks[1]);
}

fn build_diff_lines(file: &diff::DiffFile) -> (Vec<Line<'static>>, Vec<Line<'static>>) {
    let mut left_lines = Vec::new();
    let mut right_lines = Vec::new();

    for hunk in &file.hunks {
        // Add heading
        if let Some(ref heading) = hunk.heading {
            left_lines.push(Line::from(Span::styled(heading.clone(), theme::heading_style())));
            right_lines.push(Line::from(Span::styled(heading.clone(), theme::heading_style())));
        }

        let mut old_line = hunk.old_start;
        let mut new_line = hunk.new_start;

        let mut i = 0;
        while i < hunk.lines.len() {
            let line = &hunk.lines[i];

            match line.line_type {
                diff::LineType::Context => {
                    let left_num = format!("{:4}  ", old_line);
                    let right_num = format!("{:4}  ", new_line);

                    left_lines.push(Line::from(vec![
                        Span::styled(left_num, theme::context_style()),
                        Span::styled(line.content.clone(), theme::context_style()),
                    ]));

                    right_lines.push(Line::from(vec![
                        Span::styled(right_num, theme::context_style()),
                        Span::styled(line.content.clone(), theme::context_style()),
                    ]));

                    old_line += 1;
                    new_line += 1;
                    i += 1;
                }
                diff::LineType::Removed => {
                    // Collect consecutive removals
                    let mut removed = vec![];
                    while i < hunk.lines.len() {
                        if let diff::LineType::Removed = hunk.lines[i].line_type {
                            removed.push(hunk.lines[i].clone());
                            i += 1;
                        } else {
                            break;
                        }
                    }

                    // Collect consecutive additions
                    let mut added = vec![];
                    while i < hunk.lines.len() {
                        if let diff::LineType::Added = hunk.lines[i].line_type {
                            added.push(hunk.lines[i].clone());
                            i += 1;
                        } else {
                            break;
                        }
                    }

                    // Pair them up
                    let max_len = removed.len().max(added.len());
                    for j in 0..max_len {
                        if j < removed.len() {
                            let left_num = format!("{:4} -", old_line);
                            left_lines.push(Line::from(vec![
                                Span::styled(left_num, theme::removed_style()),
                                Span::styled(removed[j].content.clone(), theme::removed_style()),
                            ]));
                            old_line += 1;
                        } else {
                            left_lines.push(Line::from(""));
                        }

                        if j < added.len() {
                            let right_num = format!("{:4} +", new_line);
                            right_lines.push(Line::from(vec![
                                Span::styled(right_num, theme::added_style()),
                                Span::styled(added[j].content.clone(), theme::added_style()),
                            ]));
                            new_line += 1;
                        } else {
                            right_lines.push(Line::from(""));
                        }
                    }
                }
                diff::LineType::Added => {
                    // Addition without removal
                    left_lines.push(Line::from(""));

                    let right_num = format!("{:4} +", new_line);
                    right_lines.push(Line::from(vec![
                        Span::styled(right_num, theme::added_style()),
                        Span::styled(line.content.clone(), theme::added_style()),
                    ]));
                    new_line += 1;
                    i += 1;
                }
            }
        }

        // Empty line between hunks
        left_lines.push(Line::from(""));
        right_lines.push(Line::from(""));
    }

    (left_lines, right_lines)
}

fn render_with_file_list(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(30), Constraint::Percentage(70)])
        .split(area);

    // File list
    let items: Vec<ListItem> = app
        .files
        .iter()
        .enumerate()
        .map(|(i, file)| {
            let reviewed = app
                .state
                .files
                .get(&file.path)
                .map(|s| s.reviewed)
                .unwrap_or(false);
            let icon = if reviewed { "✓" } else { "○" };
            let current = if i == app.current_file_index {
                "→"
            } else {
                " "
            };
            let text = format!("{} {} {}", current, icon, file.path);
            ListItem::new(text)
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title("Files"))
        .style(theme::default_style())
        .highlight_style(theme::selected_style());

    let mut state = app.file_list_state.clone();
    f.render_stateful_widget(list, chunks[0], &mut state);

    // Diff preview
    render_diff_split(f, app, chunks[1]);
}

fn render_status_bar(f: &mut Frame, area: Rect) {
    let status = Paragraph::new("[r]eview [n]ext [p]rev [f]iles [j/k]scroll [d/u]page [g/G]top/bottom [q]uit")
        .style(theme::default_style());

    f.render_widget(status, area);
}
