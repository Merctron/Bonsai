mod git;
mod diff;
mod tui;
mod state;
mod theme;

use anyhow::Result;
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "bonsai")]
#[command(about = "A beautiful, opinionated git diff viewer for code review", long_about = None)]
struct Cli {
    /// Commit range (e.g., HEAD~3 or HEAD~5..HEAD~2)
    #[arg(default_value = "HEAD~1")]
    range: String,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Output static diff and exit (for piping/scripts)
    Dump,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Check if we're in a git repository
    if !git::is_git_repo()? {
        eprintln!("Error: Not a git repository");
        std::process::exit(1);
    }

    match cli.command {
        Some(Commands::Dump) => {
            // Static dump mode
            dump_mode(&cli.range)?;
        }
        None => {
            // Interactive TUI mode (default)
            tui_mode(&cli.range)?;
        }
    }

    Ok(())
}

fn tui_mode(range: &str) -> Result<()> {
    // Get diff data
    let diff_stats = git::get_diff_stats(range)?;
    if diff_stats.files_changed == 0 {
        println!("No changes found in the specified range.");
        return Ok(());
    }

    let diff_text = git::get_diff(range)?;
    let files = diff::parse_diff(&diff_text)?;

    if files.is_empty() {
        println!("No files changed.");
        return Ok(());
    }

    // Load review state
    let branch = git::get_current_branch()?;
    let mut state = state::ReviewState::load(&branch)?;

    // Initialize state for new files
    for file in &files {
        let path = file.path.clone();
        state.files.entry(path).or_insert_with(|| state::FileState {
            reviewed: false,
            last_position: 0,
        });
    }

    // Launch TUI
    tui::run(range, &branch, diff_stats, files, &mut state)?;

    // Save state on exit
    state.save(&branch)?;

    Ok(())
}

fn dump_mode(range: &str) -> Result<()> {
    // Get diff stats
    let stats = git::get_diff_stats(range)?;
    if stats.files_changed == 0 {
        println!("No changes found in the specified range.");
        return Ok(());
    }

    // Print stats header
    println!();
    println!("{}", "━".repeat(120));
    print!("  {} │ {} files changed", range, stats.files_changed);
    if stats.insertions > 0 {
        print!(" +{}", stats.insertions);
    }
    if stats.deletions > 0 {
        print!(" -{}", stats.deletions);
    }
    println!();
    println!("{}", "━".repeat(120));

    // Get and print diff
    let diff_text = git::get_diff(range)?;
    let files = diff::parse_diff(&diff_text)?;

    for file in files {
        println!();
        println!("{}", "─".repeat(120));
        println!("  {}", file.path);
        println!("{}", "─".repeat(120));

        for hunk in file.hunks {
            if let Some(heading) = hunk.heading {
                println!("  {}", heading);
            }

            let mut old_line = hunk.old_start;
            let mut new_line = hunk.new_start;

            for line in hunk.lines {
                match line.line_type {
                    diff::LineType::Context => {
                        print!("{:4}  ", old_line);
                        print!("{:width$}", line.content, width = 50);
                        print!(" │ ");
                        print!("{:4}  ", new_line);
                        println!("{}", line.content);
                        old_line += 1;
                        new_line += 1;
                    }
                    diff::LineType::Removed => {
                        print!("{:4} -", old_line);
                        print!("{:width$}", line.content, width = 50);
                        println!(" │ ");
                        old_line += 1;
                    }
                    diff::LineType::Added => {
                        print!("{:width$}", "", width = 56);
                        print!(" │ ");
                        print!("{:4} +", new_line);
                        println!("{}", line.content);
                        new_line += 1;
                    }
                }
            }
        }
    }

    Ok(())
}
