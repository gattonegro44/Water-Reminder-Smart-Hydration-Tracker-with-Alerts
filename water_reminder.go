# water_reminder.go
/**
 * 💧 Water Reminder – Smart Hydration Tracker with Alerts (Go Edition)
 * Features: add intake, daily goal, configurable reminders, stats, persistence
 */

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// ─── Data Model ─────────────────────────────────────────────────────────────

type Entry struct {
	Date      string `json:"date"`
	Amount    int    `json:"amount"`
	Timestamp string `json:"timestamp"`
}

type Data struct {
	Goal             int     `json:"goal"`
	ReminderInterval int     `json:"reminder_interval"`
	LastReminder     string  `json:"last_reminder"`
	Entries          []Entry `json:"entries"`
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const (
	reset  = "\x1b[0m"
	bright = "\x1b[1m"
	dim    = "\x1b[2m"
	red    = "\x1b[31m"
	green  = "\x1b[32m"
	yellow = "\x1b[33m"
	blue   = "\x1b[34m"
	magenta = "\x1b[35m"
	cyan   = "\x1b[36m"
)

func c(str, color string) string {
	return color + str + reset
}

// ─── Config ──────────────────────────────────────────────────────────────────

const (
	defaultGoal     = 2000
	defaultInterval = 30
)

// ─── Data Manager ──────────────────────────────────────────────────────────

type WaterReminder struct {
	goal         int
	interval     int
	lastReminder string
	entries      []Entry
	filePath     string
	reader       *bufio.Reader
}

func NewWaterReminder() *WaterReminder {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".water_reminder")
	os.MkdirAll(dir, 0755)
	filePath := filepath.Join(dir, "data.json")
	w := &WaterReminder{filePath: filePath, reader: bufio.NewReader(os.Stdin)}
	w.load()
	w.checkReminder()
	// Periodic check every minute
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		for range ticker.C {
			w.checkReminder()
		}
	}()
	return w
}

func (w *WaterReminder) load() {
	if _, err := os.Stat(w.filePath); os.IsNotExist(err) {
		w.goal = defaultGoal
		w.interval = defaultInterval
		w.lastReminder = ""
		w.entries = []Entry{}
		return
	}
	raw, err := os.ReadFile(w.filePath)
	if err != nil {
		w.goal = defaultGoal
		w.interval = defaultInterval
		w.lastReminder = ""
		w.entries = []Entry{}
		return
	}
	var data Data
	if err := json.Unmarshal(raw, &data); err != nil {
		w.goal = defaultGoal
		w.interval = defaultInterval
		w.lastReminder = ""
		w.entries = []Entry{}
		return
	}
	w.goal = data.Goal
	if w.goal <= 0 {
		w.goal = defaultGoal
	}
	w.interval = data.ReminderInterval
	if w.interval <= 0 {
		w.interval = defaultInterval
	}
	w.lastReminder = data.LastReminder
	w.entries = data.Entries
	if w.entries == nil {
		w.entries = []Entry{}
	}
}

func (w *WaterReminder) save() {
	data := Data{
		Goal:             w.goal,
		ReminderInterval: w.interval,
		LastReminder:     w.lastReminder,
		Entries:          w.entries,
	}
	raw, _ := json.MarshalIndent(data, "", "  ")
	os.WriteFile(w.filePath, raw, 0644)
}

func (w *WaterReminder) today() string {
	return time.Now().Format("2006-01-02")
}

func (w *WaterReminder) getTodayEntries() []Entry {
	today := w.today()
	var res []Entry
	for _, e := range w.entries {
		if e.Date == today {
			res = append(res, e)
		}
	}
	return res
}

func (w *WaterReminder) getTodayTotal() int {
	total := 0
	for _, e := range w.getTodayEntries() {
		total += e.Amount
	}
	return total
}

func (w *WaterReminder) progressBar(current, goal, width int) string {
	if goal <= 0 {
		return "⚠️  Goal not set"
	}
	ratio := float64(current) / float64(goal)
	if ratio > 1.0 {
		ratio = 1.0
	}
	filled := int(ratio * float64(width))
	bar := strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
	return fmt.Sprintf("[%s] %.1f%%", bar, ratio*100)
}

func (w *WaterReminder) checkReminder() {
	if w.lastReminder == "" {
		w.lastReminder = time.Now().Format(time.RFC3339)
		w.save()
		return
	}
	last, err := time.Parse(time.RFC3339, w.lastReminder)
	if err != nil {
		w.lastReminder = time.Now().Format(time.RFC3339)
		w.save()
		return
	}
	elapsed := time.Since(last).Minutes()
	if elapsed >= float64(w.interval) {
		fmt.Printf("%s\n", c("\n⏰ Time to drink water! (%d min since last reminder)", cyan), w.interval)
		w.lastReminder = time.Now().Format(time.RFC3339)
		w.save()
	}
}

// ─── Core Actions ──────────────────────────────────────────────────────────

func (w *WaterReminder) addEntry(amount int) {
	if amount <= 0 {
		fmt.Println(c("❌ Amount must be positive!", red))
		return
	}
	w.entries = append(w.entries, Entry{
		Date:      w.today(),
		Amount:    amount,
		Timestamp: time.Now().Format(time.RFC3339),
	})
	w.save()
	todayTotal := w.getTodayTotal()
	fmt.Printf(c("✅ Added %dml (Total today: %dml)\n", green), amount, todayTotal)
	if todayTotal >= w.goal {
		fmt.Println(c("🎉 Goal achieved! Stay hydrated! 💪", cyan))
	}
}

func (w *WaterReminder) showToday() {
	todayTotal := w.getTodayTotal()
	entries := w.getTodayEntries()
	fmt.Println("\n" + c(strings.Repeat("═", 50), dim))
	fmt.Println(c("💧 TODAY'S HYDRATION", bright+cyan))
	fmt.Println(c(strings.Repeat("═", 50), dim))
	fmt.Printf("  Goal:      %s\n", c(strconv.Itoa(w.goal)+"ml", cyan))
	fmt.Printf("  Consumed:  %s\n", c(strconv.Itoa(todayTotal)+"ml", green))
	remaining := w.goal - todayTotal
	if remaining < 0 {
		remaining = 0
	}
	fmt.Printf("  Remaining: %s\n", c(strconv.Itoa(remaining)+"ml", yellow))
	fmt.Printf("  Progress:  %s\n", w.progressBar(todayTotal, w.goal, 20))
	fmt.Println(c(strings.Repeat("═", 50), dim))
	if len(entries) > 0 {
		fmt.Println("  Entries:")
		for i, e := range entries {
			ts := "—"
			if len(e.Timestamp) >= 16 {
				ts = e.Timestamp[11:16]
			}
			fmt.Printf("    %d. %s → %s\n", i+1, ts, c(strconv.Itoa(e.Amount)+"ml", green))
		}
	} else {
		fmt.Println(c("  No entries yet today. Drink up! 💧", dim))
	}
}

func (w *WaterReminder) showStats() {
	if len(w.entries) == 0 {
		fmt.Println(c("📭 No data yet. Start tracking!", yellow))
		return
	}
	total := 0
	for _, e := range w.entries {
		total += e.Amount
	}
	count := len(w.entries)
	avg := float64(total) / float64(count)
	days := make(map[string]bool)
	for _, e := range w.entries {
		days[e.Date] = true
	}
	fmt.Println("\n📊 STATISTICS")
	fmt.Println(c(strings.Repeat("─", 30), dim))
	fmt.Printf("  Total Consumed: %dml\n", total)
	fmt.Printf("  Total Entries:  %d\n", count)
	fmt.Printf("  Days Tracked:   %d\n", len(days))
	fmt.Printf("  Average per Entry: %.1fml\n", avg)
	fmt.Printf("  Daily Goal:     %dml\n", w.goal)
	fmt.Printf("  Reminder Interval: %d min\n", w.interval)
}

func (w *WaterReminder) setGoal(goal int) {
	if goal <= 0 {
		fmt.Println(c("❌ Goal must be positive!", red))
		return
	}
	w.goal = goal
	w.save()
	fmt.Printf(c("✅ Daily goal set to %dml\n", green), goal)
}

func (w *WaterReminder) setInterval(minutes int) {
	if minutes <= 0 {
		fmt.Println(c("❌ Interval must be positive!", red))
		return
	}
	w.interval = minutes
	w.save()
	fmt.Printf(c("✅ Reminder interval set to %d minutes\n", green), minutes)
}

func (w *WaterReminder) remindNow() {
	fmt.Println(c("\n💧 Time to drink some water! Stay hydrated!", cyan))
	w.lastReminder = time.Now().Format(time.RFC3339)
	w.save()
}

func (w *WaterReminder) clearData() {
	fmt.Print("⚠️  Delete ALL data? (yes/no): ")
	ans, _ := w.reader.ReadString('\n')
	ans = strings.TrimSpace(strings.ToLower(ans))
	if ans != "yes" {
		return
	}
	w.entries = []Entry{}
	w.goal = defaultGoal
	w.interval = defaultInterval
	w.lastReminder = ""
	w.save()
	fmt.Println(c("🗑️  All data cleared.", yellow))
}

// ─── Menu ──────────────────────────────────────────────────────────────────

func (w *WaterReminder) ask(prompt string) string {
	fmt.Print(prompt)
	line, _ := w.reader.ReadString('\n')
	return strings.TrimSpace(line)
}

func (w *WaterReminder) askInt(prompt string) int {
	for {
		ans := w.ask(prompt)
		if val, err := strconv.Atoi(ans); err == nil {
			return val
		}
		fmt.Println(c("❌ Please enter a number.", red))
	}
}

func (w *WaterReminder) showMenu() {
	todayTotal := w.getTodayTotal()
	progress := w.progressBar(todayTotal, w.goal, 20)
	fmt.Println("\n" + c(strings.Repeat("═", 50), cyan))
	fmt.Println(c("💧 WATER REMINDER", bright+cyan))
	fmt.Println(c(strings.Repeat("═", 50), cyan))
	fmt.Printf("  Today: %dml / %dml  %s\n", todayTotal, w.goal, progress)
	fmt.Printf("  Reminder: every %d min\n", w.interval)
	fmt.Println(c(strings.Repeat("─", 50), dim))
	fmt.Println("  1. 💧 Add water intake")
	fmt.Println("  2. 📊 Today's progress")
	fmt.Println("  3. 📈 Statistics")
	fmt.Printf("  4. 🎯 Set daily goal (current: %dml)\n", w.goal)
	fmt.Printf("  5. ⏰ Set reminder interval (current: %d min)\n", w.interval)
	fmt.Println("  6. 🔔 Check reminder now")
	fmt.Println("  7. 🗑️  Clear all data")
	fmt.Println("  0. 🚪 Exit")
	fmt.Println(c(strings.Repeat("═", 50), cyan))
}

func (w *WaterReminder) run() {
	fmt.Print("\033[H\033[2J")
	fmt.Println(c("\n💧 Water Reminder – Stay Hydrated!", bright+cyan))
	fmt.Println(c("Never forget to drink water again!", dim))

	for {
		w.showMenu()
		choice := w.ask("Your choice: ")
		switch choice {
		case "1":
			amount := w.askInt("Amount in ml: ")
			w.addEntry(amount)
		case "2":
			w.showToday()
		case "3":
			w.showStats()
		case "4":
			goal := w.askInt("New daily goal (ml): ")
			w.setGoal(goal)
		case "5":
			interval := w.askInt("Interval (minutes): ")
			w.setInterval(interval)
		case "6":
			w.remindNow()
		case "7":
			w.clearData()
		case "0":
			fmt.Println(c("👋 Stay hydrated! Goodbye!", cyan))
			return
		default:
			fmt.Println(c("❌ Invalid choice.", red))
		}
		if choice != "0" {
			fmt.Print("\nPress Enter to continue...")
			w.reader.ReadString('\n')
		}
	}
}

func main() {
	app := NewWaterReminder()
	app.run()
}
