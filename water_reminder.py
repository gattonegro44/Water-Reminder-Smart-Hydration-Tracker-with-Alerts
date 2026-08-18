# water_reminder.py
#!/usr/bin/env python3
"""
💧 Water Reminder – Smart Hydration Tracker with Alerts (Python Edition)
Features: add intake, daily goal, configurable reminders, stats, persistence, colored UI
"""

import json
import os
import sys
import time
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.prompt import Prompt, IntPrompt, Confirm
    from rich import box
    from rich.progress import Progress, BarColumn, TextColumn
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("⚠️  Install 'rich' for enhanced UI: pip install rich")


# ─── Colors ──────────────────────────────────────────────────────────────────

def c(text: str, color: str) -> str:
    colors = {
        "reset": "\033[0m", "bright": "\033[1m", "dim": "\033[2m",
        "red": "\033[31m", "green": "\033[32m", "yellow": "\033[33m",
        "blue": "\033[34m", "magenta": "\033[35m", "cyan": "\033[36m"
    }
    return f"{colors.get(color, '')}{text}{colors['reset']}"


# ─── Data Manager ──────────────────────────────────────────────────────────

class WaterReminder:
    DATA_DIR = Path.home() / ".water_reminder"
    DATA_FILE = DATA_DIR / "data.json"
    DEFAULT_GOAL = 2000
    DEFAULT_INTERVAL = 30  # minutes

    def __init__(self):
        self.console = Console() if RICH_AVAILABLE else None
        self.data = self._load()
        self.goal = self.data.get("goal", self.DEFAULT_GOAL)
        self.interval = self.data.get("reminder_interval", self.DEFAULT_INTERVAL)
        self.last_reminder = self.data.get("last_reminder")
        self.entries: List[Dict] = self.data.get("entries", [])
        self._check_reminder()

    def _load(self) -> Dict:
        if self.DATA_FILE.exists():
            try:
                with open(self.DATA_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save(self) -> None:
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        data = {
            "goal": self.goal,
            "reminder_interval": self.interval,
            "last_reminder": self.last_reminder,
            "entries": self.entries
        }
        with open(self.DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)

    def _today(self) -> str:
        return datetime.now().strftime("%Y-%m-%d")

    def _get_today_entries(self) -> List[Dict]:
        today = self._today()
        return [e for e in self.entries if e.get("date") == today]

    def _get_today_total(self) -> int:
        return sum(e.get("amount", 0) for e in self._get_today_entries())

    def _progress_bar(self, current: int, goal: int, width: int = 20) -> str:
        if goal <= 0:
            return "⚠️  Goal not set"
        ratio = min(current / goal, 1.0)
        filled = int(ratio * width)
        bar = "█" * filled + "░" * (width - filled)
        return f"[{bar}] {ratio*100:.1f}%"

    def _check_reminder(self) -> None:
        """Check if it's time to remind the user."""
        if self.last_reminder is None:
            self.last_reminder = datetime.now().isoformat()
            self._save()
            return
        last = datetime.fromisoformat(self.last_reminder)
        now = datetime.now()
        elapsed = (now - last).total_seconds() / 60
        if elapsed >= self.interval:
            msg = c(f"⏰ Time to drink water! ({self.interval} min since last reminder)", "cyan")
            if self.console:
                self.console.print(Panel(msg, title="💧 Reminder", border_style="magenta"))
            else:
                print(msg)
            self.last_reminder = now.isoformat()
            self._save()

    # ─── Core Actions ──────────────────────────────────────────────────────

    def add_entry(self, amount: int) -> None:
        if amount <= 0:
            print(c("❌ Amount must be positive!", "red"))
            return
        entry = {
            "date": self._today(),
            "amount": amount,
            "timestamp": datetime.now().isoformat()
        }
        self.entries.append(entry)
        self._save()
        today_total = self._get_today_total()
        if self.console:
            self.console.print(f"[green]✅ Added {amount}ml (Total today: {today_total}ml)[/green]")
            if today_total >= self.goal:
                self.console.print("[bold cyan]🎉 Goal achieved! Stay hydrated! 💪[/bold cyan]")
        else:
            print(c(f"✅ Added {amount}ml (Total today: {today_total}ml)", "green"))
            if today_total >= self.goal:
                print(c("🎉 Goal achieved! Stay hydrated! 💪", "cyan"))

    def show_today(self) -> None:
        today_total = self._get_today_total()
        entries = self._get_today_entries()
        if self.console:
            panel = Panel(
                f"[bold]💧 Today's Hydration[/bold]\n"
                f"  Goal: {self.goal}ml\n"
                f"  Consumed: {today_total}ml\n"
                f"  Remaining: {max(self.goal - today_total, 0)}ml\n"
                f"  Progress: {self._progress_bar(today_total, self.goal)}",
                title="📊 Daily Progress",
                border_style="cyan"
            )
            self.console.print(panel)
            if entries:
                table = Table(title="Today's Entries", box=box.ROUNDED)
                table.add_column("#", style="dim")
                table.add_column("Time", style="cyan")
                table.add_column("Amount", style="green", justify="right")
                for i, e in enumerate(entries, 1):
                    ts = e.get("timestamp", "")[11:16] if "T" in e.get("timestamp", "") else "—"
                    table.add_row(str(i), ts, f"{e['amount']}ml")
                self.console.print(table)
            else:
                self.console.print("[dim]No entries yet today. Drink up! 💧[/dim]")
        else:
            print("\n" + "="*50)
            print(c("💧 TODAY'S HYDRATION", "bright"))
            print("="*50)
            print(f"  Goal:      {self.goal}ml")
            print(f"  Consumed:  {today_total}ml")
            print(f"  Remaining: {max(self.goal - today_total, 0)}ml")
            print(f"  Progress:  {self._progress_bar(today_total, self.goal)}")
            print("="*50)
            if entries:
                print("  Entries:")
                for i, e in enumerate(entries, 1):
                    ts = e.get("timestamp", "")[11:16] if "T" in e.get("timestamp", "") else "—"
                    print(f"    {i}. {ts} → {e['amount']}ml")
            else:
                print("  No entries yet today.")

    def show_stats(self) -> None:
        if not self.entries:
            print(c("📭 No data yet. Start tracking!", "yellow"))
            return
        total = sum(e.get("amount", 0) for e in self.entries)
        count = len(self.entries)
        avg = total / count if count else 0
        days = len(set(e.get("date") for e in self.entries))
        if self.console:
            table = Table(title="📊 Statistics", box=box.ROUNDED)
            table.add_column("Metric", style="cyan")
            table.add_column("Value", style="green")
            table.add_row("Total Consumed", f"{total}ml")
            table.add_row("Total Entries", str(count))
            table.add_row("Days Tracked", str(days))
            table.add_row("Average per Entry", f"{avg:.1f}ml")
            table.add_row("Daily Goal", f"{self.goal}ml")
            table.add_row("Reminder Interval", f"{self.interval} min")
            self.console.print(table)
        else:
            print("\n📊 STATISTICS")
            print(c("─"*30, "dim"))
            print(f"  Total Consumed: {total}ml")
            print(f"  Total Entries:  {count}")
            print(f"  Days Tracked:   {days}")
            print(f"  Average per Entry: {avg:.1f}ml")
            print(f"  Daily Goal:     {self.goal}ml")
            print(f"  Reminder Interval: {self.interval} min")

    def set_goal(self, goal: int) -> None:
        if goal <= 0:
            print(c("❌ Goal must be positive!", "red"))
            return
        self.goal = goal
        self._save()
        print(c(f"✅ Daily goal set to {goal}ml", "green"))

    def set_interval(self, minutes: int) -> None:
        if minutes <= 0:
            print(c("❌ Interval must be positive!", "red"))
            return
        self.interval = minutes
        self._save()
        print(c(f"✅ Reminder interval set to {minutes} minutes", "green"))

    def remind_now(self) -> None:
        """Manually trigger a reminder."""
        msg = c("💧 Time to drink some water! Stay hydrated!", "cyan")
        if self.console:
            self.console.print(Panel(msg, title="💧 Reminder", border_style="magenta"))
        else:
            print(msg)
        self.last_reminder = datetime.now().isoformat()
        self._save()

    def clear_data(self) -> None:
        if self.console:
            if not Confirm.ask("⚠️  Delete ALL data? This cannot be undone!"):
                return
        else:
            if input("⚠️  Delete ALL data? (yes/no): ").strip().lower() != "yes":
                return
        self.entries = []
        self.goal = self.DEFAULT_GOAL
        self.interval = self.DEFAULT_INTERVAL
        self.last_reminder = None
        self._save()
        print(c("🗑️  All data cleared.", "yellow"))

    # ─── Menu ──────────────────────────────────────────────────────────────

    def _show_menu(self) -> None:
        today_total = self._get_today_total()
        progress = self._progress_bar(today_total, self.goal)
        if self.console:
            menu = f"""
[bold cyan]💧 Water Reminder[/bold cyan]
  Today: {today_total}ml / {self.goal}ml  {progress}
  Reminder: every {self.interval} min

  [1] 💧 Add water intake
  [2] 📊 Today's progress
  [3] 📈 Statistics
  [4] 🎯 Set daily goal (current: {self.goal}ml)
  [5] ⏰ Set reminder interval (current: {self.interval} min)
  [6] 🔔 Check reminder now
  [7] 🗑️  Clear all data
  [0] 🚪 Exit
"""
            self.console.print(Panel(menu, border_style="blue"))
        else:
            print("\n" + "-"*50)
            print(f"💧 Today: {today_total}ml / {self.goal}ml  {progress}")
            print(f"   Reminder: every {self.interval} min")
            print("-"*50)
            print("  1. 💧 Add water intake")
            print("  2. 📊 Today's progress")
            print("  3. 📈 Statistics")
            print(f"  4. 🎯 Set daily goal (current: {self.goal}ml)")
            print(f"  5. ⏰ Set reminder interval (current: {self.interval} min)")
            print("  6. 🔔 Check reminder now")
            print("  7. 🗑️  Clear all data")
            print("  0. 🚪 Exit")
            print("-"*50)

    def _get_choice(self) -> str:
        if self.console:
            return Prompt.ask("Your choice", choices=["0","1","2","3","4","5","6","7"])
        return input("Your choice: ").strip()

    def _get_amount(self) -> Optional[int]:
        if self.console:
            return IntPrompt.ask("Amount in ml")
        try:
            return int(input("Amount in ml: ").strip())
        except ValueError:
            print(c("❌ Please enter a number.", "red"))
            return None

    def _get_goal(self) -> Optional[int]:
        if self.console:
            return IntPrompt.ask("New daily goal in ml")
        try:
            return int(input("New daily goal (ml): ").strip())
        except ValueError:
            print(c("❌ Please enter a number.", "red"))
            return None

    def _get_interval(self) -> Optional[int]:
        if self.console:
            return IntPrompt.ask("Reminder interval in minutes")
        try:
            return int(input("Interval (minutes): ").strip())
        except ValueError:
            print(c("❌ Please enter a number.", "red"))
            return None

    def run(self) -> None:
        # Check reminder on startup
        self._check_reminder()
        if self.console:
            self.console.print(Panel.fit("[bold cyan]💧 Water Reminder – Stay Hydrated![/bold cyan]", border_style="cyan"))
        else:
            print(c("\n💧 Water Reminder – Stay Hydrated!", "bright"))
            print(c("Never forget to drink water again!", "dim"))

        while True:
            self._show_menu()
            choice = self._get_choice()
            if choice == "1":
                amount = self._get_amount()
                if amount:
                    self.add_entry(amount)
            elif choice == "2":
                self.show_today()
            elif choice == "3":
                self.show_stats()
            elif choice == "4":
                goal = self._get_goal()
                if goal:
                    self.set_goal(goal)
            elif choice == "5":
                interval = self._get_interval()
                if interval:
                    self.set_interval(interval)
            elif choice == "6":
                self.remind_now()
            elif choice == "7":
                self.clear_data()
            elif choice == "0":
                print(c("👋 Stay hydrated! Goodbye!", "cyan"))
                break
            else:
                print(c("❌ Invalid choice.", "red"))

            if choice != "0":
                if self.console:
                    self.console.print("\n[dim]Press Enter to continue...[/dim]")
                    input()
                else:
                    input("\nPress Enter to continue...")


def main():
    try:
        app = WaterReminder()
        app.run()
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(c(f"❌ Unexpected error: {e}", "red"))
        sys.exit(1)

if __name__ == "__main__":
    main()
