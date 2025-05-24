#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct CommandResult {
    success: bool,
    output: String,
    error: String,
}

// Get path to m1ddc executable
fn get_m1ddc_path() -> String {
    // Try to use 'which' to find m1ddc
    let which_output = Command::new("which")
        .arg("m1ddc")
        .output();
    
    if let Ok(output) = which_output {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }
    
    // Fallback to common locations
    for path in [
        "/opt/homebrew/bin/m1ddc",
        "/usr/local/bin/m1ddc",
        "/usr/bin/m1ddc",
        "m1ddc" // Last resort, try PATH
    ] {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    
    // Default fallback
    "m1ddc".to_string()
}

// Execute m1ddc command
#[tauri::command]
fn execute_m1ddc_command(command: String) -> CommandResult {
    // Split the command string into parts
    let mut parts = command.split_whitespace();
    
    // First part should be "m1ddc"
    if let Some(cmd) = parts.next() {
        if cmd != "m1ddc" {
            return CommandResult {
                success: false,
                output: String::new(),
                error: "Only m1ddc commands are allowed".into(),
            };
        }
    }
    
    // Get m1ddc path
    let m1ddc_path = get_m1ddc_path();
    
    // Execute the command with the full path
    let output = Command::new(&m1ddc_path)
        .args(parts)
        .output();
    
    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            
            CommandResult {
                success: output.status.success(),
                output: stdout,
                error: stderr,
            }
        },
        Err(e) => CommandResult {
            success: false,
            output: String::new(),
            error: format!("Failed to execute command: {} ({})", e, m1ddc_path),
        },
    }
}

// List all available displays
#[tauri::command]
fn list_displays() -> Vec<String> {
    // Get m1ddc path
    let m1ddc_path = get_m1ddc_path();
    
    let output = Command::new(&m1ddc_path)
        .args(["display", "list"])
        .output();
    
    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            stdout.lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| line.trim().to_string())
                .collect()
        },
        Err(e) => {
            // Return error as a display for debugging
            vec![format!("Error: {} ({})", e, m1ddc_path)]
        },
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            execute_m1ddc_command,
            list_displays
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}