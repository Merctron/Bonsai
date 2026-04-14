use ratatui::style::{Color, Style};

// Custom color palette
pub const BACKGROUND: Color = Color::Rgb(48, 41, 47);          // #30292f
pub const ADDITION_LINE: Color = Color::Rgb(0, 99, 93);        // #00635D
pub const DELETION_LINE: Color = Color::Rgb(143, 0, 10);       // #8F000A

// Text colors
pub const TEXT_PRIMARY: Color = Color::White;
pub const TEXT_DIM: Color = Color::Gray;
pub const TEXT_HEADING: Color = Color::Cyan;

// Diff colors
pub const ADDED_FG: Color = Color::Green;
pub const REMOVED_FG: Color = Color::Red;
pub const CONTEXT_FG: Color = Color::White;

// Syntax highlighting colors
pub const KEYWORD_COLOR: Color = Color::Magenta;
pub const STRING_COLOR: Color = Color::Green;
pub const NUMBER_COLOR: Color = Color::Blue;
pub const COMMENT_COLOR: Color = Color::Gray;

// Styles
pub fn default_style() -> Style {
    Style::default()
        .fg(TEXT_PRIMARY)
        .bg(BACKGROUND)
}

pub fn header_style() -> Style {
    Style::default()
        .fg(TEXT_PRIMARY)
        .bg(BACKGROUND)
}

pub fn added_style() -> Style {
    Style::default()
        .fg(ADDED_FG)
        .bg(BACKGROUND)
}

pub fn removed_style() -> Style {
    Style::default()
        .fg(REMOVED_FG)
        .bg(BACKGROUND)
}

pub fn context_style() -> Style {
    Style::default()
        .fg(CONTEXT_FG)
        .bg(BACKGROUND)
}

pub fn heading_style() -> Style {
    Style::default()
        .fg(TEXT_HEADING)
        .bg(BACKGROUND)
}

pub fn selected_style() -> Style {
    Style::default()
        .fg(TEXT_PRIMARY)
        .bg(ADDITION_LINE)
}
