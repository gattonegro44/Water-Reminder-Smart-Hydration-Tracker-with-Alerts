# WaterReminder.cs
/**
 * 💧 Water Reminder – Smart Hydration Tracker with Alerts (C# Edition)
 * Features: add intake, daily goal, configurable reminders, stats, persistence
 * Requires: .NET 6.0+
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

class WaterReminder
{
    // ─── Colors ────────────────────────────────────────────────────────────

    private static readonly string Reset = "\u001B[0m";
    private static readonly string Bright = "\u001B[1m";
    private static readonly string Dim = "\u001B[2m";
    private static readonly string Red = "\u001B[31m";
    private static readonly string Green = "\u001B[32m";
    private static readonly string Yellow = "\u001B[33m";
    private static readonly string Blue = "\u001B[34m";
    private static readonly string Magenta = "\u001B[35m";
    private static readonly string Cyan = "\u001B[36m";

    private static string C(string text, string color) => color + text + Reset;

    // ─── Data Model ──────────────────────────────────────────────────────

    public class Entry
    {
        [JsonPropertyName("date")]
        public string Date { get; set; } = "";
        [JsonPropertyName("amount")]
        public int Amount { get; set; }
        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = "";
    }

    public class Data
    {
        [JsonPropertyName("goal")]
        public int Goal { get; set; } = 2000;
        [JsonPropertyName("reminder_interval")]
        public int ReminderInterval { get; set; } = 30;
        [JsonPropertyName("last_reminder")]
        public string LastReminder { get; set; } = "";
        [JsonPropertyName("entries")]
        public List<Entry> Entries { get; set; } = new();
    }

    // ─── Config ────────────────────────────────────────────────────────────

    private static readonly string DataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".water_reminder"
    );
    private static readonly string DataFile = Path.Combine(DataDir, "data.json");

    // ─── Water Reminder ──────────────────────────────────────────────────

    private readonly Data data = new();
    private readonly Timer reminderTimer;

    public WaterReminder()
    {
        Directory.CreateDirectory(DataDir);
        Load();
        CheckReminder();
        // Set up timer to check every minute
        reminderTimer = new Timer(_ => CheckReminder(), null, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));
    }

    private void Load()
    {
        if (!File.Exists(DataFile)) return;
        try
        {
            string json = File.ReadAllText(DataFile);
            var loaded = JsonSerializer.Deserialize<Data>(json);
            if (loaded != null)
            {
                data.Goal = loaded.Goal > 0 ? loaded.Goal : 2000;
                data.ReminderInterval = loaded.ReminderInterval > 0 ? loaded.ReminderInterval : 30;
                data.LastReminder = loaded.LastReminder ?? "";
                data.Entries = loaded.Entries ?? new List<Entry>();
            }
        }
        catch { /* ignore */ }
    }

    private void Save()
    {
        string json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(DataFile, json);
    }

    private string Today() => DateTime.Now.ToString("yyyy-MM-dd");
    private string Timestamp() => DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss");

    private List<Entry> GetTodayEntries()
    {
        string today = Today();
        return data.Entries.Where(e => e.Date == today).ToList();
    }

    private int GetTodayTotal() => GetTodayEntries().Sum(e => e.Amount);

    private string ProgressBar(int current, int goal, int width = 20)
    {
        if (goal <= 0) return "⚠️  Goal not set";
        double ratio = Math.Min((double)current / goal, 1.0);
        int filled = (int)(ratio * width);
        string bar = new string('█', filled) + new string('░', width - filled);
        return $"[{bar}] {ratio * 100.0:F1}%";
    }

    private void CheckReminder()
    {
        if (string.IsNullOrEmpty(data.LastReminder))
        {
            data.LastReminder = Timestamp();
            Save();
            return;
        }
        if (DateTime.TryParse(data.LastReminder, out DateTime last))
        {
            var now = DateTime.Now;
            var elapsed = (now - last).TotalMinutes;
            if (elapsed >= data.ReminderInterval)
            {
                Console.WriteLine(C($"\n⏰ Time to drink water! ({data.ReminderInterval} min since last reminder)", Cyan));
                data.LastReminder = Timestamp();
                Save();
            }
        }
    }

    // ─── Core Actions ──────────────────────────────────────────────────────

    private void AddEntry(int amount)
    {
        if (amount <= 0)
        {
            Console.WriteLine(C("❌ Amount must be positive!", Red));
            return;
        }
        data.Entries.Add(new Entry { Date = Today(), Amount = amount, Timestamp = Timestamp() });
        Save();
        int todayTotal = GetTodayTotal();
        Console.WriteLine(C($"✅ Added {amount}ml (Total today: {todayTotal}ml)", Green));
        if (todayTotal >= data.Goal)
        {
            Console.WriteLine(C("🎉 Goal achieved! Stay hydrated! 💪", Cyan));
        }
    }

    private void ShowToday()
    {
        int todayTotal = GetTodayTotal();
        var entries = GetTodayEntries();
        Console.WriteLine("\n" + C(new string('═', 50), Dim));
        Console.WriteLine(C("💧 TODAY'S HYDRATION", Bright + Cyan));
        Console.WriteLine(C(new string('═', 50), Dim));
        Console.WriteLine($"  Goal:      {C($"{data.Goal}ml", Cyan)}");
        Console.WriteLine($"  Consumed:  {C($"{todayTotal}ml", Green)}");
        int remaining = Math.Max(data.Goal - todayTotal, 0);
        Console.WriteLine($"  Remaining: {C($"{remaining}ml", Yellow)}");
        Console.WriteLine($"  Progress:  {ProgressBar(todayTotal, data.Goal)}");
        Console.WriteLine(C(new string('═', 50), Dim));
        if (entries.Count == 0)
        {
            Console.WriteLine(C("  No entries yet today. Drink up! 💧", Dim));
        }
        else
        {
            Console.WriteLine("  Entries:");
            for (int i = 0; i < entries.Count; i++)
            {
                var e = entries[i];
                string ts = e.Timestamp.Length >= 16 ? e.Timestamp[11..16] : "—";
                Console.WriteLine($"    {i+1}. {ts} → {C($"{e.Amount}ml", Green)}");
            }
        }
    }

    private void ShowStats()
    {
        if (data.Entries.Count == 0)
        {
            Console.WriteLine(C("📭 No data yet. Start tracking!", Yellow));
            return;
        }
        int total = data.Entries.Sum(e => e.Amount);
        int count = data.Entries.Count;
        double avg = (double)total / count;
        int days = data.Entries.Select(e => e.Date).Distinct().Count();
        Console.WriteLine("\n📊 STATISTICS");
        Console.WriteLine(C(new string('─', 30), Dim));
        Console.WriteLine($"  Total Consumed: {total}ml");
        Console.WriteLine($"  Total Entries:  {count}");
        Console.WriteLine($"  Days Tracked:   {days}");
        Console.WriteLine($"  Average per Entry: {avg:F1}ml");
        Console.WriteLine($"  Daily Goal:     {data.Goal}ml");
        Console.WriteLine($"  Reminder Interval: {data.ReminderInterval} min");
    }

    private void SetGoal(int goal)
    {
        if (goal <= 0)
        {
            Console.WriteLine(C("❌ Goal must be positive!", Red));
            return;
        }
        data.Goal = goal;
        Save();
        Console.WriteLine(C($"✅ Daily goal set to {goal}ml", Green));
    }

    private void SetInterval(int minutes)
    {
        if (minutes <= 0)
        {
            Console.WriteLine(C("❌ Interval must be positive!", Red));
            return;
        }
        data.ReminderInterval = minutes;
        Save();
        Console.WriteLine(C($"✅ Reminder interval set to {minutes} minutes", Green));
    }

    private void RemindNow()
    {
        Console.WriteLine(C("\n💧 Time to drink some water! Stay hydrated!", Cyan));
        data.LastReminder = Timestamp();
        Save();
    }

    private void ClearData()
    {
        Console.Write("⚠️  Delete ALL data? (yes/no): ");
        string ans = Console.ReadLine()?.Trim() ?? "";
        if (!ans.Equals("yes", StringComparison.OrdinalIgnoreCase)) return;
        data.Entries.Clear();
        data.Goal = 2000;
        data.ReminderInterval = 30;
        data.LastReminder = "";
        Save();
        Console.WriteLine(C("🗑️  All data cleared.", Yellow));
    }

    // ─── Menu ──────────────────────────────────────────────────────────────

    private string Ask(string prompt)
    {
        Console.Write(prompt);
        return Console.ReadLine()?.Trim() ?? "";
    }

    private int AskInt(string prompt)
    {
        while (true)
        {
            if (int.TryParse(Ask(prompt), out int val)) return val;
            Console.WriteLine(C("❌ Please enter a number.", Red));
        }
    }

    private void ShowMenu()
    {
        int todayTotal = GetTodayTotal();
        string progress = ProgressBar(todayTotal, data.Goal);
        Console.WriteLine("\n" + C(new string('═', 50), Cyan));
        Console.WriteLine(C("💧 WATER REMINDER", Bright + Cyan));
        Console.WriteLine(C(new string('═', 50), Cyan));
        Console.WriteLine($"  Today: {todayTotal}ml / {data.Goal}ml  {progress}");
        Console.WriteLine($"  Reminder: every {data.ReminderInterval} min");
        Console.WriteLine(C(new string('─', 50), Dim));
        Console.WriteLine("  1. 💧 Add water intake");
        Console.WriteLine("  2. 📊 Today's progress");
        Console.WriteLine("  3. 📈 Statistics");
        Console.WriteLine($"  4. 🎯 Set daily goal (current: {data.Goal}ml)");
        Console.WriteLine($"  5. ⏰ Set reminder interval (current: {data.ReminderInterval} min)");
        Console.WriteLine("  6. 🔔 Check reminder now");
        Console.WriteLine("  7. 🗑️  Clear all data");
        Console.WriteLine("  0. 🚪 Exit");
        Console.WriteLine(C(new string('═', 50), Cyan));
    }

    public void Run()
    {
        Console.Clear();
        Console.WriteLine(C("\n💧 Water Reminder – Stay Hydrated!", Bright + Cyan));
        Console.WriteLine(C("Never forget to drink water again!", Dim));

        while (true)
        {
            ShowMenu();
            string choice = Ask("Your choice: ");
            switch (choice)
            {
                case "1":
                    int amount = AskInt("Amount in ml: ");
                    AddEntry(amount);
                    break;
                case "2":
                    ShowToday();
                    break;
                case "3":
                    ShowStats();
                    break;
                case "4":
                    int goal = AskInt("New daily goal (ml): ");
                    SetGoal(goal);
                    break;
                case "5":
                    int interval = AskInt("Interval (minutes): ");
                    SetInterval(interval);
                    break;
                case "6":
                    RemindNow();
                    break;
                case "7":
                    ClearData();
                    break;
                case "0":
                    Console.WriteLine(C("👋 Stay hydrated! Goodbye!", Cyan));
                    return;
                default:
                    Console.WriteLine(C("❌ Invalid choice.", Red));
                    break;
            }
            if (choice != "0")
            {
                Console.Write("\nPress Enter to continue...");
                Console.ReadLine();
            }
        }
    }

    public static void Main()
    {
        try
        {
            new WaterReminder().Run();
        }
        catch (Exception ex)
        {
            Console.WriteLine(C($"❌ Unexpected error: {ex.Message}", Red));
            Environment.Exit(1);
        }
    }
}
