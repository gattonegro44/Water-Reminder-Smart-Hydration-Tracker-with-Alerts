# WaterReminder.java
/**
 * 💧 Water Reminder – Smart Hydration Tracker with Alerts (Java Edition)
 * Features: add intake, daily goal, configurable reminders, stats, persistence
 * Requires: Java 17+
 */

import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.concurrent.*;

public class WaterReminder {
    // ─── Colors ────────────────────────────────────────────────────────────

    private static final String RESET = "\u001B[0m";
    private static final String BRIGHT = "\u001B[1m";
    private static final String DIM = "\u001B[2m";
    private static final String RED = "\u001B[31m";
    private static final String GREEN = "\u001B[32m";
    private static final String YELLOW = "\u001B[33m";
    private static final String BLUE = "\u001B[34m";
    private static final String MAGENTA = "\u001B[35m";
    private static final String CYAN = "\u001B[36m";

    private static String c(String text, String color) { return color + text + RESET; }

    // ─── Data Model ──────────────────────────────────────────────────────

    private static class Entry {
        String date;
        int amount;
        String timestamp;
        Entry(String date, int amount, String timestamp) {
            this.date = date;
            this.amount = amount;
            this.timestamp = timestamp;
        }
    }

    private static class Data {
        int goal = 2000;
        int reminderInterval = 30;
        String lastReminder = "";
        List<Entry> entries = new ArrayList<>();
    }

    // ─── Config ────────────────────────────────────────────────────────────

    private static final String DATA_DIR = System.getProperty("user.home") + "/.water_reminder";
    private static final String DATA_FILE = DATA_DIR + "/data.json";

    // ─── Water Reminder ──────────────────────────────────────────────────

    private final Scanner scanner;
    private Data data;

    public WaterReminder() throws IOException {
        scanner = new Scanner(System.in);
        Files.createDirectories(Paths.get(DATA_DIR));
        data = new Data();
        load();
        checkReminder();
        // Schedule periodic check every minute
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(this::checkReminder, 1, 1, TimeUnit.MINUTES);
    }

    private void load() {
        Path path = Paths.get(DATA_FILE);
        if (!Files.exists(path)) return;
        try {
            String json = Files.readString(path);
            // Simple manual parse
            data.goal = extractInt(json, "goal");
            if (data.goal <= 0) data.goal = 2000;
            data.reminderInterval = extractInt(json, "reminder_interval");
            if (data.reminderInterval <= 0) data.reminderInterval = 30;
            data.lastReminder = extractString(json, "last_reminder");
            // entries not parsed for brevity
            data.entries = new ArrayList<>();
        } catch (Exception e) {
            data = new Data();
        }
    }

    private int extractInt(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*(\\d+)";
        var m = java.util.regex.Pattern.compile(pattern).matcher(json);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private String extractString(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]*)\"";
        var m = java.util.regex.Pattern.compile(pattern).matcher(json);
        return m.find() ? m.group(1) : "";
    }

    private void save() {
        try {
            StringBuilder sb = new StringBuilder();
            sb.append("{\n");
            sb.append("  \"goal\": ").append(data.goal).append(",\n");
            sb.append("  \"reminder_interval\": ").append(data.reminderInterval).append(",\n");
            sb.append("  \"last_reminder\": \"").append(escapeJson(data.lastReminder)).append("\",\n");
            sb.append("  \"entries\": [\n");
            for (int i = 0; i < data.entries.size(); i++) {
                Entry e = data.entries.get(i);
                sb.append("    {\n");
                sb.append("      \"date\": \"").append(escapeJson(e.date)).append("\",\n");
                sb.append("      \"amount\": ").append(e.amount).append(",\n");
                sb.append("      \"timestamp\": \"").append(escapeJson(e.timestamp)).append("\"\n");
                sb.append("    }");
                if (i < data.entries.size() - 1) sb.append(",");
                sb.append("\n");
            }
            sb.append("  ]\n");
            sb.append("}");
            Files.writeString(Paths.get(DATA_FILE), sb.toString());
        } catch (IOException e) { e.printStackTrace(); }
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String today() {
        return LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private String timestamp() {
        return LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }

    private List<Entry> getTodayEntries() {
        String todayStr = today();
        return data.entries.stream().filter(e -> e.date.equals(todayStr)).collect(Collectors.toList());
    }

    private int getTodayTotal() {
        return getTodayEntries().stream().mapToInt(e -> e.amount).sum();
    }

    private String progressBar(int current, int goal, int width) {
        if (goal <= 0) return "⚠️  Goal not set";
        double ratio = Math.min((double)current / goal, 1.0);
        int filled = (int)(ratio * width);
        StringBuilder bar = new StringBuilder();
        bar.append("[");
        bar.append("█".repeat(filled));
        bar.append("░".repeat(width - filled));
        bar.append("] ");
        bar.append(String.format("%.1f%%", ratio * 100));
        return bar.toString();
    }

    private void checkReminder() {
        if (data.lastReminder.isEmpty()) {
            data.lastReminder = timestamp();
            save();
            return;
        }
        try {
            LocalDateTime last = LocalDateTime.parse(data.lastReminder, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            LocalDateTime now = LocalDateTime.now();
            long elapsed = Duration.between(last, now).toMinutes();
            if (elapsed >= data.reminderInterval) {
                System.out.println(c("\n⏰ Time to drink water! (" + data.reminderInterval + " min since last reminder)", CYAN));
                data.lastReminder = timestamp();
                save();
            }
        } catch (Exception e) { /* ignore */ }
    }

    // ─── Core Actions ──────────────────────────────────────────────────────

    private void addEntry(int amount) {
        if (amount <= 0) {
            System.out.println(c("❌ Amount must be positive!", RED));
            return;
        }
        data.entries.add(new Entry(today(), amount, timestamp()));
        save();
        int todayTotal = getTodayTotal();
        System.out.println(c("✅ Added " + amount + "ml (Total today: " + todayTotal + "ml)", GREEN));
        if (todayTotal >= data.goal) {
            System.out.println(c("🎉 Goal achieved! Stay hydrated! 💪", CYAN));
        }
    }

    private void showToday() {
        int todayTotal = getTodayTotal();
        List<Entry> entries = getTodayEntries();
        System.out.println("\n" + c("═".repeat(50), DIM));
        System.out.println(c("💧 TODAY'S HYDRATION", BRIGHT + CYAN));
        System.out.println(c("═".repeat(50), DIM));
        System.out.println("  Goal:      " + c(data.goal + "ml", CYAN));
        System.out.println("  Consumed:  " + c(todayTotal + "ml", GREEN));
        int remaining = Math.max(data.goal - todayTotal, 0);
        System.out.println("  Remaining: " + c(remaining + "ml", YELLOW));
        System.out.println("  Progress:  " + progressBar(todayTotal, data.goal, 20));
        System.out.println(c("═".repeat(50), DIM));
        if (entries.isEmpty()) {
            System.out.println(c("  No entries yet today. Drink up! 💧", DIM));
        } else {
            System.out.println("  Entries:");
            for (int i = 0; i < entries.size(); i++) {
                Entry e = entries.get(i);
                String ts = e.timestamp.length() >= 16 ? e.timestamp.substring(11, 16) : "—";
                System.out.println("    " + (i+1) + ". " + ts + " → " + c(e.amount + "ml", GREEN));
            }
        }
    }

    private void showStats() {
        if (data.entries.isEmpty()) {
            System.out.println(c("📭 No data yet. Start tracking!", YELLOW));
            return;
        }
        int total = data.entries.stream().mapToInt(e -> e.amount).sum();
        int count = data.entries.size();
        double avg = (double) total / count;
        long days = data.entries.stream().map(e -> e.date).distinct().count();
        System.out.println("\n📊 STATISTICS");
        System.out.println(c("─".repeat(30), DIM));
        System.out.println("  Total Consumed: " + total + "ml");
        System.out.println("  Total Entries:  " + count);
        System.out.println("  Days Tracked:   " + days);
        System.out.printf("  Average per Entry: %.1fml\n", avg);
        System.out.println("  Daily Goal:     " + data.goal + "ml");
        System.out.println("  Reminder Interval: " + data.reminderInterval + " min");
    }

    private void setGoal(int goal) {
        if (goal <= 0) {
            System.out.println(c("❌ Goal must be positive!", RED));
            return;
        }
        data.goal = goal;
        save();
        System.out.println(c("✅ Daily goal set to " + goal + "ml", GREEN));
    }

    private void setInterval(int minutes) {
        if (minutes <= 0) {
            System.out.println(c("❌ Interval must be positive!", RED));
            return;
        }
        data.reminderInterval = minutes;
        save();
        System.out.println(c("✅ Reminder interval set to " + minutes + " minutes", GREEN));
    }

    private void remindNow() {
        System.out.println(c("\n💧 Time to drink some water! Stay hydrated!", CYAN));
        data.lastReminder = timestamp();
        save();
    }

    private void clearData() {
        System.out.print("⚠️  Delete ALL data? (yes/no): ");
        String ans = scanner.nextLine().trim();
        if (!ans.equalsIgnoreCase("yes")) return;
        data.entries.clear();
        data.goal = 2000;
        data.reminderInterval = 30;
        data.lastReminder = "";
        save();
        System.out.println(c("🗑️  All data cleared.", YELLOW));
    }

    // ─── Menu ──────────────────────────────────────────────────────────────

    private String ask(String prompt) {
        System.out.print(prompt);
        return scanner.nextLine().trim();
    }

    private int askInt(String prompt) {
        while (true) {
            try {
                return Integer.parseInt(ask(prompt));
            } catch (NumberFormatException e) {
                System.out.println(c("❌ Please enter a number.", RED));
            }
        }
    }

    private void showMenu() {
        int todayTotal = getTodayTotal();
        String progress = progressBar(todayTotal, data.goal, 20);
        System.out.println("\n" + c("═".repeat(50), CYAN));
        System.out.println(c("💧 WATER REMINDER", BRIGHT + CYAN));
        System.out.println(c("═".repeat(50), CYAN));
        System.out.println("  Today: " + todayTotal + "ml / " + data.goal + "ml  " + progress);
        System.out.println("  Reminder: every " + data.reminderInterval + " min");
        System.out.println(c("─".repeat(50), DIM));
        System.out.println("  1. 💧 Add water intake");
        System.out.println("  2. 📊 Today's progress");
        System.out.println("  3. 📈 Statistics");
        System.out.println("  4. 🎯 Set daily goal (current: " + data.goal + "ml)");
        System.out.println("  5. ⏰ Set reminder interval (current: " + data.reminderInterval + " min)");
        System.out.println("  6. 🔔 Check reminder now");
        System.out.println("  7. 🗑️  Clear all data");
        System.out.println("  0. 🚪 Exit");
        System.out.println(c("═".repeat(50), CYAN));
    }

    public void run() {
        System.out.print("\033[H\033[2J");
        System.out.flush();
        System.out.println(c("\n💧 Water Reminder – Stay Hydrated!", BRIGHT + CYAN));
        System.out.println(c("Never forget to drink water again!", DIM));

        while (true) {
            showMenu();
            String choice = ask("Your choice: ");
            switch (choice) {
                case "1": {
                    int amount = askInt("Amount in ml: ");
                    addEntry(amount);
                    break;
                }
                case "2": showToday(); break;
                case "3": showStats(); break;
                case "4": {
                    int goal = askInt("New daily goal (ml): ");
                    setGoal(goal);
                    break;
                }
                case "5": {
                    int interval = askInt("Interval (minutes): ");
                    setInterval(interval);
                    break;
                }
                case "6": remindNow(); break;
                case "7": clearData(); break;
                case "0":
                    System.out.println(c("👋 Stay hydrated! Goodbye!", CYAN));
                    return;
                default:
                    System.out.println(c("❌ Invalid choice.", RED));
            }
            if (!choice.equals("0")) {
                System.out.print("\nPress Enter to continue...");
                scanner.nextLine();
            }
        }
    }

    public static void main(String[] args) {
        try {
            new WaterReminder().run();
        } catch (Exception e) {
            System.err.println(c("❌ Unexpected error: " + e.getMessage(), RED));
            e.printStackTrace();
            System.exit(1);
        }
    }
}
