use anyhow::{Context, Result};
use git2::Repository;
use std::process::Command;

pub struct DiffStats {
    pub files_changed: usize,
    pub insertions: usize,
    pub deletions: usize,
}

pub fn is_git_repo() -> Result<bool> {
    Ok(Repository::discover(".").is_ok())
}

pub fn get_current_branch() -> Result<String> {
    let repo = Repository::discover(".")?;
    let head = repo.head()?;

    if let Some(name) = head.shorthand() {
        Ok(name.to_string())
    } else {
        Ok("HEAD".to_string())
    }
}

pub fn get_diff(range: &str) -> Result<String> {
    let range = parse_range(range);

    let output = Command::new("git")
        .args(&[
            "diff",
            &range,
            "--unified=3",
            "-w",  // Ignore whitespace
            "--ignore-blank-lines",
        ])
        .output()
        .context("Failed to execute git diff")?;

    if !output.status.success() {
        anyhow::bail!("git diff failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    Ok(String::from_utf8(output.stdout)?)
}

pub fn get_diff_stats(range: &str) -> Result<DiffStats> {
    let range = parse_range(range);

    let output = Command::new("git")
        .args(&[
            "diff",
            &range,
            "--stat",
            "-w",
            "--ignore-blank-lines",
        ])
        .output()
        .context("Failed to execute git diff --stat")?;

    if !output.status.success() {
        anyhow::bail!("git diff --stat failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    let stats_text = String::from_utf8(output.stdout)?;
    parse_stats(&stats_text)
}

fn parse_range(range: &str) -> String {
    if range.contains("..") {
        range.to_string()
    } else {
        format!("{}..HEAD", range)
    }
}

fn parse_stats(text: &str) -> Result<DiffStats> {
    let lines: Vec<&str> = text.trim().split('\n').collect();
    if lines.is_empty() {
        return Ok(DiffStats {
            files_changed: 0,
            insertions: 0,
            deletions: 0,
        });
    }

    let summary_line = lines.last().unwrap_or(&"");

    let files_changed = extract_number(summary_line, "file");
    let insertions = extract_number(summary_line, "insertion");
    let deletions = extract_number(summary_line, "deletion");

    Ok(DiffStats {
        files_changed,
        insertions,
        deletions,
    })
}

fn extract_number(text: &str, pattern: &str) -> usize {
    for part in text.split(',') {
        if part.contains(pattern) {
            if let Some(num_str) = part.trim().split_whitespace().next() {
                if let Ok(num) = num_str.parse::<usize>() {
                    return num;
                }
            }
        }
    }
    0
}
