use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileState {
    pub reviewed: bool,
    pub last_position: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewState {
    pub files: HashMap<String, FileState>,
}

impl ReviewState {
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
        }
    }

    pub fn load(branch: &str) -> Result<Self> {
        let path = Self::get_state_path(branch);

        if path.exists() {
            let content = fs::read_to_string(&path)?;
            let state: ReviewState = serde_json::from_str(&content)?;
            Ok(state)
        } else {
            Ok(Self::new())
        }
    }

    pub fn save(&self, branch: &str) -> Result<()> {
        let path = Self::get_state_path(branch);
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&path, content)?;
        Ok(())
    }

    fn get_state_path(branch: &str) -> PathBuf {
        let safe_branch = branch.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
        PathBuf::from(format!(".bonsai-review-{}.json", safe_branch))
    }

    pub fn get_reviewed_count(&self) -> usize {
        self.files.values().filter(|f| f.reviewed).count()
    }
}
