use anyhow::Result;

#[derive(Debug, Clone)]
pub enum LineType {
    Context,
    Added,
    Removed,
}

#[derive(Debug, Clone)]
pub struct DiffLine {
    pub line_type: LineType,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct Hunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub heading: Option<String>,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone)]
pub struct DiffFile {
    pub path: String,
    pub old_path: String,
    pub new_path: String,
    pub hunks: Vec<Hunk>,
}

pub fn parse_diff(diff_text: &str) -> Result<Vec<DiffFile>> {
    let mut files = Vec::new();
    let lines: Vec<&str> = diff_text.split('\n').collect();

    let mut i = 0;
    let mut current_file: Option<DiffFile> = None;
    let mut current_hunk: Option<Hunk> = None;

    while i < lines.len() {
        let line = lines[i];

        if line.starts_with("diff --git") {
            // Save previous file
            if let Some(mut file) = current_file.take() {
                if let Some(hunk) = current_hunk.take() {
                    file.hunks.push(hunk);
                }
                files.push(file);
            }

            // Parse new file
            if let Some(paths) = line.strip_prefix("diff --git ") {
                let parts: Vec<&str> = paths.split_whitespace().collect();
                if parts.len() >= 2 {
                    let old_path = parts[0].strip_prefix("a/").unwrap_or(parts[0]);
                    let new_path = parts[1].strip_prefix("b/").unwrap_or(parts[1]);

                    current_file = Some(DiffFile {
                        path: new_path.to_string(),
                        old_path: old_path.to_string(),
                        new_path: new_path.to_string(),
                        hunks: Vec::new(),
                    });
                }
            }
        } else if line.starts_with("@@") {
            // Save previous hunk
            if let Some(hunk) = current_hunk.take() {
                if let Some(ref mut file) = current_file {
                    file.hunks.push(hunk);
                }
            }

            // Parse new hunk
            // Format: @@ -old_start,old_count +new_start,new_count @@ heading
            let line = line.strip_prefix("@@").unwrap_or(line);
            if let Some((range, heading)) = line.split_once("@@") {
                let parts: Vec<&str> = range.trim().split_whitespace().collect();
                if parts.len() >= 2 {
                    let old = parse_hunk_range(parts[0]);
                    let new = parse_hunk_range(parts[1]);

                    current_hunk = Some(Hunk {
                        old_start: old.0,
                        old_lines: old.1,
                        new_start: new.0,
                        new_lines: new.1,
                        heading: if heading.trim().is_empty() {
                            None
                        } else {
                            Some(heading.trim().to_string())
                        },
                        lines: Vec::new(),
                    });
                }
            }
        } else if let Some(ref mut hunk) = current_hunk {
            // Content lines
            if line.starts_with('+') && !line.starts_with("+++") {
                hunk.lines.push(DiffLine {
                    line_type: LineType::Added,
                    content: line[1..].to_string(),
                });
            } else if line.starts_with('-') && !line.starts_with("---") {
                hunk.lines.push(DiffLine {
                    line_type: LineType::Removed,
                    content: line[1..].to_string(),
                });
            } else if line.starts_with(' ') {
                hunk.lines.push(DiffLine {
                    line_type: LineType::Context,
                    content: line[1..].to_string(),
                });
            }
        }

        i += 1;
    }

    // Save last file and hunk
    if let Some(mut file) = current_file {
        if let Some(hunk) = current_hunk {
            file.hunks.push(hunk);
        }
        files.push(file);
    }

    Ok(files)
}

fn parse_hunk_range(range: &str) -> (usize, usize) {
    let range = range.trim_start_matches(&['-', '+'][..]);
    let parts: Vec<&str> = range.split(',').collect();

    let start = parts[0].parse().unwrap_or(1);
    let count = if parts.len() > 1 {
        parts[1].parse().unwrap_or(1)
    } else {
        1
    };

    (start, count)
}
