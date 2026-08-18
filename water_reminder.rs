# water_reminder.rs
/**
 * 💧 Water Reminder – Smart Hydration Tracker with Alerts (Rust Edition)
 * Features: add intake, daily goal, configurable reminders, stats, persistence
 * Dependencies: serde, serde_json, chrono, colored
 */

use chrono::{DateTime, Local, Duration};
use colored::*;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::{self, Write, BufRead};
use std::path::PathBuf;
use std::thread;
use std::time;

// ─── Data Model ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Entry {
    date: String,
    amount: u32,
    timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Data {
    goal: u32,
    reminder_interval: u32,
    last_reminder: String,
    entries: Vec<Entry>,
}

// ─── Colors ──────────────────────────────────────────────────────────────────

fn c(text: &str, color: &str) -> String {
    match color {
        "green" => text.green().to_string(),
        "red" => text.red().to_string(),
        "yellow" => text.yellow().to_string(),
        "cyan" => text.cyan().to_string(),
        "bright" => text.bright().to_string(),
        "dim" => text.dimmed().to_string(),
        _ => text.to_string(),
    }
}

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_GOAL: u32 = 2000;
const DEFAULT_INTERVAL: u32 = 30;

// ─── Data Manager ──────────────────────────────────────────────────────────

struct WaterReminder {
    goal: u32,
    interval: u32,
    last_reminder: String,
    entries: Vec<Entry>,
    file_path: PathBuf,
}

impl WaterReminder {
    fn new() -> Self {
        let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_else(|_| ".".to_string());
        let dir = PathBuf::from(home).join(".water_reminder");
        fs::create_dir_all(&dir).unwrap();
        let file_path = dir.join("data.json");
        let mut w = WaterReminder {
            goal: DEFAULT_GOAL,
            interval: DEFAULT_INTERVAL,
            last_reminder: "".to_string(),
            entries: Vec::new(),
            file_path,
        };
        w.load();
        w.check_reminder();
        // Spawn a thread for periodic reminder check
        let w_clone = w.clone_without_io();
        thread::spawn(move || {
            let interval = time::Duration::from_secs(60);
            loop {
                thread::sleep(interval);
                w_clone.check_reminder();
            }
        });
        w
    }

    // Helper to clone without the file_path (we can't share easily)
    fn clone_without_io(&self) -> Self {
        WaterReminder {
            goal: self.goal,
            interval: self.interval,
            last_reminder: self.last_reminder.clone(),
            entries: self.entries.clone(),
            file_path: self.file_path.clone(),
        }
    }

    fn load(&mut self) {
        if let Ok(raw) = fs::read_to_string(&self.file_path) {
            if let Ok(data) = serde_json::from_str::<Data>(&raw) {
                self.goal = if data.goal > 0 { data.goal } else { DEFAULT_GOAL };
                self.interval = if data.reminder_interval > 0 { data.reminder_interval } else { DEFAULT_INTERVAL };
                self.last_reminder = data.last_reminder;
                self.entries = data.entries;
                return;
            }
        }
        self.goal = DEFAULT_GOAL;
        self.interval = DEFAULT_INTERVAL;
        self.last_reminder = "".to_string();
        self.entries = Vec::new();
    }

    fn save(&self) {
        let data = Data {
            goal: self.goal,
            reminder_interval: self.interval,
            last_reminder: self.last_reminder.clone(),
            entries: self.entries.clone(),
        };
        let raw = serde_json::to_string_pretty(&data).unwrap();
        let _ = fs::write(&self.file_path, raw);
    }

    fn today(&self) -> String {
        Local::now().format("%Y-%m-%d").to_string()
    }

    fn get_today_entries(&self) -> Vec<Entry> {
        let today = self.today();
        self.entries.iter().filter(|e| e.date == today).cloned().collect()
    }

    fn get_today_total(&self) -> u32 {
        self.get_today_entries().iter().map(|e| e.amount).sum()
    }

    fn progress_bar(&self, current: u32, goal: u32, width: usize) -> String {
        if goal == 0 {
            return "⚠️  Goal not set".to_string();
        }
        let ratio = (current as f64 / goal as f64).min(1.0);
        let filled = (ratio * width as f64) as usize;
        let bar = "█".repeat(filled) + &"░".repeat(width - filled);
        format!("[{}] {:.1}%", bar, ratio * 100.0)
    }

    fn check_reminder(&self) {
        if self.last_reminder.is_empty() {
            // first run, set last reminder to now
            let mut w = self.clone_without_io();
            w.last_reminder = Local::now().to_rfc3339();
            w.save();
            return;
        }
        if let Ok(last) = DateTime::parse_from_rfc3339(&self.last_reminder) {
            let now = Local::now();
            let elapsed = (now - last).num_minutes();
            if elapsed >= self.interval as i64 {
                println!("{}", c(&format!("\n⏰ Time to drink water! ({} min since last reminder)", self.interval), "cyan"));
                let mut w = self.clone_without_io();
                w.last_reminder = now.to_rfc3339();
                w.save();
            }
        }
    }

    // ─── Core Actions ──────────────────────────────────────────────────────

    fn add_entry(&mut self, amount: u32) {
        if amount == 0 {
            println!("{}", c("❌ Amount must be positive!", "red"));
            return;
        }
        self.entries.push(Entry {
            date: self.today(),
            amount,
            timestamp: Local::now().to_rfc3339(),
        });
        self.save();
        let today_total = self.get_today_total();
        println!("{}", c(&format!("✅ Added {}ml (Total today: {}ml)", amount, today_total), "green"));
        if today_total >= self.goal {
            println!("{}", c("🎉 Goal achieved! Stay hydrated! 💪", "cyan"));
        }
    }

    fn show_today(&self) {
        let today_total = self.get_today_total();
        let entries = self.get_today_entries();
        println!("\n{}", "═".repeat(50).dimmed());
        println!("{}", c("💧 TODAY'S HYDRATION", "bright") + &c("", "cyan"));
        println!("{}", "═".repeat(50).dimmed());
        println!("  Goal:      {}", c(&format!("{}ml", self.goal), "cyan"));
        println!("  Consumed:  {}", c(&format!("{}ml", today_total), "green"));
        let remaining = if self.goal > today_total { self.goal - today_total } else { 0 };
        println!("  Remaining: {}", c(&format!("{}ml", remaining), "yellow"));
        println!("  Progress:  {}", self.progress_bar(today_total, self.goal, 20));
        println!("{}", "═".repeat(50).dimmed());
        if entries.is_empty() {
            println!("{}", c("  No entries yet today. Drink up! 💧", "dim"));
        } else {
            println!("  Entries:");
            for (i, e) in entries.iter().enumerate() {
                let ts = if e.timestamp.len() >= 16 { &e.timestamp[11..16] } else { "—" };
                println!("    {}. {} → {}", i+1, ts, c(&format!("{}ml", e.amount), "green"));
            }
        }
    }

    fn show_stats(&self) {
        if self.entries.is_empty() {
            println!("{}", c("📭 No data yet. Start tracking!", "yellow"));
            return;
        }
        let total: u32 = self.entries.iter().map(|e| e.amount).sum();
        let count = self.entries.len();
        let avg = total as f64 / count as f64;
        let days: HashSet<_> = self.entries.iter().map(|e| &e.date).collect();
        println!("\n📊 STATISTICS");
        println!("{}", "─".repeat(30).dimmed());
        println!("  Total Consumed: {}ml", total);
        println!("  Total Entries:  {}", count);
        println!("  Days Tracked:   {}", days.len());
        println!("  Average per Entry: {:.1}ml", avg);
        println!("  Daily Goal:     {}ml", self.goal);
        println!("  Reminder Interval: {} min", self.interval);
    }

    fn set_goal(&mut self, goal: u32) {
        if goal == 0 {
            println!("{}", c("❌ Goal must be positive!", "red"));
            return;
        }
        self.goal = goal;
        self.save();
        println!("{}", c(&format!("✅ Daily goal set to {}ml", goal), "green"));
    }

    fn set_interval(&mut self, minutes: u32) {
        if minutes == 0 {
            println!("{}", c("❌ Interval must be positive!", "red"));
            return;
        }
        self.interval = minutes;
        self.save();
        println!("{}", c(&format!("✅ Reminder interval set to {} minutes", minutes), "green"));
    }

    fn remind_now(&mut self) {
        println!("{}", c("\n💧 Time to drink some water! Stay hydrated!", "cyan"));
        self.last_reminder = Local::now().to_rfc3339();
        self.save();
    }

    fn clear_data(&mut self) {
        print!("⚠️  Delete ALL data? (yes/no): ");
        io::stdout().flush().unwrap();
        let mut ans = String::new();
        io::stdin().read_line(&mut ans).unwrap();
        if ans.trim().to_lowercase() != "yes" { return; }
        self.entries = Vec::new();
        self.goal = DEFAULT_GOAL;
        self.interval = DEFAULT_INTERVAL;
        self.last_reminder = "".to_string();
        self.save();
        println!("{}", c("🗑️  All data cleared.", "yellow"));
    }

    // ─── Menu ──────────────────────────────────────────────────────────────

    fn ask(&self, prompt: &str) -> String {
        print!("{}", prompt);
        io::stdout().flush().unwrap();
        let mut line = String::new();
        io::stdin().read_line(&mut line).unwrap();
        line.trim().to_string()
    }

    fn ask_u32(&self, prompt: &str) -> u32 {
        loop {
            let ans = self.ask(prompt);
            if let Ok(val) = ans.parse::<u32>() {
                return val;
            }
            println!("{}", c("❌ Please enter a number.", "red"));
        }
    }

    fn show_menu(&self) {
        let today_total = self.get_today_total();
        let progress = self.progress_bar(today_total, self.goal, 20);
        println!("\n{}", "═".repeat(50).cyan());
        println!("{}", c("💧 WATER REMINDER", "bright") + &c("", "cyan"));
        println!("{}", "═".repeat(50).cyan());
        println!("  Today: {}ml / {}ml  {}", today_total, self.goal, progress);
        println!("  Reminder: every {} min", self.interval);
        println!("{}", "─".repeat(50).dimmed());
        println!("  1. 💧 Add water intake");
        println!("  2. 📊 Today's progress");
        println!("  3. 📈 Statistics");
        println!("  4. 🎯 Set daily goal (current: {}ml)", self.goal);
        println!("  5. ⏰ Set reminder interval (current: {} min)", self.interval);
        println!("  6. 🔔 Check reminder now");
        println!("  7. 🗑️  Clear all data");
        println!("  0. 🚪 Exit");
        println!("{}", "═".repeat(50).cyan());
    }

    fn run(&mut self) {
        println!("{}", "\n💧 Water Reminder – Stay Hydrated!".bright().cyan());
        println!("{}", "Never forget to drink water again!".dimmed());

        loop {
            self.show_menu();
            let choice = self.ask("Your choice: ");
            match choice.as_str() {
                "1" => {
                    let amount = self.ask_u32("Amount in ml: ");
                    self.add_entry(amount);
                }
                "2" => self.show_today(),
                "3" => self.show_stats(),
                "4" => {
                    let goal = self.ask_u32("New daily goal (ml): ");
                    self.set_goal(goal);
                }
                "5" => {
                    let interval = self.ask_u32("Interval (minutes): ");
                    self.set_interval(interval);
                }
                "6" => self.remind_now(),
                "7" => self.clear_data(),
                "0" => {
                    println!("{}", c("👋 Stay hydrated! Goodbye!", "cyan"));
                    return;
                }
                _ => println!("{}", c("❌ Invalid choice.", "red")),
            }
            if choice != "0" {
                print!("\nPress Enter to continue...");
                io::stdout().flush().unwrap();
                let mut _dummy = String::new();
                io::stdin().read_line(&mut _dummy).unwrap();
            }
        }
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

fn main() {
    let mut app = WaterReminder::new();
    app.run();
}
