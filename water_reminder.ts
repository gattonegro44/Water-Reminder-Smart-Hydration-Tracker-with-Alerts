# water_reminder.ts
/**
 * 💧 Water Reminder – Smart Hydration Tracker with Alerts (TypeScript Edition)
 * Fully typed, advanced: add intake, daily goal, configurable reminders, stats, persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Entry {
    date: string;
    amount: number;
    timestamp: string;
}

interface Data {
    goal: number;
    reminder_interval: number;
    last_reminder: string | null;
    entries: Entry[];
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

const c = (str: string, color: string): string => `${color}${str}${colors.reset}`;

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG = {
    dataDir: path.join(os.homedir(), '.water_reminder'),
    dataFile: 'data.json',
    defaultGoal: 2000,
    defaultInterval: 30,
};

// ─── Data Manager ──────────────────────────────────────────────────────────

class WaterReminder {
    private rl: readline.Interface;
    private goal: number;
    private interval: number;
    private lastReminder: string | null;
    private entries: Entry[];

    constructor() {
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const data = this._load();
        this.goal = data.goal || CONFIG.defaultGoal;
        this.interval = data.reminder_interval || CONFIG.defaultInterval;
        this.lastReminder = data.last_reminder || null;
        this.entries = data.entries || [];
        this._checkReminder();
        setInterval(() => this._checkReminder(), 60000);
    }

    private _getDataPath(): string {
        if (!fs.existsSync(CONFIG.dataDir)) fs.mkdirSync(CONFIG.dataDir, { recursive: true });
        return path.join(CONFIG.dataDir, CONFIG.dataFile);
    }

    private _load(): Data {
        const file = this._getDataPath();
        if (fs.existsSync(file)) {
            try {
                return JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (_) { return { goal: CONFIG.defaultGoal, reminder_interval: CONFIG.defaultInterval, last_reminder: null, entries: [] }; }
        }
        return { goal: CONFIG.defaultGoal, reminder_interval: CONFIG.defaultInterval, last_reminder: null, entries: [] };
    }

    private _save(): void {
        const data: Data = {
            goal: this.goal,
            reminder_interval: this.interval,
            last_reminder: this.lastReminder,
            entries: this.entries
        };
        fs.writeFileSync(this._getDataPath(), JSON.stringify(data, null, 2));
    }

    private _today(): string {
        return new Date().toISOString().split('T')[0];
    }

    private _getTodayEntries(): Entry[] {
        const today = this._today();
        return this.entries.filter(e => e.date === today);
    }

    private _getTodayTotal(): number {
        return this._getTodayEntries().reduce((s, e) => s + e.amount, 0);
    }

    private _progressBar(current: number, goal: number, width: number = 20): string {
        if (goal <= 0) return '⚠️  Goal not set';
        const ratio = Math.min(current / goal, 1);
        const filled = Math.floor(ratio * width);
        return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(ratio * 100).toFixed(1)}%`;
    }

    private _checkReminder(): void {
        if (!this.lastReminder) {
            this.lastReminder = new Date().toISOString();
            this._save();
            return;
        }
        const last = new Date(this.lastReminder);
        const now = new Date();
        const elapsed = (now.getTime() - last.getTime()) / 60000;
        if (elapsed >= this.interval) {
            console.log(c(`\n⏰ Time to drink water! (${this.interval} min since last reminder)`, 'cyan'));
            this.lastReminder = now.toISOString();
            this._save();
        }
    }

    // ─── Core Actions ──────────────────────────────────────────────────────

    addEntry(amount: number): void {
        if (amount <= 0) {
            console.log(c('❌ Amount must be positive!', 'red'));
            return;
        }
        this.entries.push({
            date: this._today(),
            amount,
            timestamp: new Date().toISOString()
        });
        this._save();
        const todayTotal = this._getTodayTotal();
        console.log(c(`✅ Added ${amount}ml (Total today: ${todayTotal}ml)`, 'green'));
        if (todayTotal >= this.goal) {
            console.log(c('🎉 Goal achieved! Stay hydrated! 💪', 'cyan'));
        }
    }

    showToday(): void {
        const todayTotal = this._getTodayTotal();
        const entries = this._getTodayEntries();
        console.log('\n' + c('═'.repeat(50), 'dim'));
        console.log(c('💧 TODAY\'S HYDRATION', 'bright') + c('', 'cyan'));
        console.log(c('═'.repeat(50), 'dim'));
        console.log(`  Goal:      ${c(this.goal + 'ml', 'cyan')}`);
        console.log(`  Consumed:  ${c(todayTotal + 'ml', 'green')}`);
        console.log(`  Remaining: ${c(Math.max(this.goal - todayTotal, 0) + 'ml', 'yellow')}`);
        console.log(`  Progress:  ${this._progressBar(todayTotal, this.goal)}`);
        console.log(c('═'.repeat(50), 'dim'));
        if (entries.length) {
            console.log('  Entries:');
            entries.forEach((e, i) => {
                const ts = e.timestamp ? e.timestamp.slice(11, 16) : '—';
                console.log(`    ${i+1}. ${ts} → ${c(e.amount + 'ml', 'green')}`);
            });
        } else {
            console.log(c('  No entries yet today. Drink up! 💧', 'dim'));
        }
    }

    showStats(): void {
        if (!this.entries.length) {
            console.log(c('📭 No data yet. Start tracking!', 'yellow'));
            return;
        }
        const total = this.entries.reduce((s, e) => s + e.amount, 0);
        const count = this.entries.length;
        const avg = total / count;
        const days = new Set(this.entries.map(e => e.date)).size;
        console.log('\n📊 STATISTICS');
        console.log(c('─'.repeat(30), 'dim'));
        console.log(`  Total Consumed: ${total}ml`);
        console.log(`  Total Entries:  ${count}`);
        console.log(`  Days Tracked:   ${days}`);
        console.log(`  Average per Entry: ${avg.toFixed(1)}ml`);
        console.log(`  Daily Goal:     ${this.goal}ml`);
        console.log(`  Reminder Interval: ${this.interval} min`);
    }

    setGoal(goal: number): void {
        if (goal <= 0) {
            console.log(c('❌ Goal must be positive!', 'red'));
            return;
        }
        this.goal = goal;
        this._save();
        console.log(c(`✅ Daily goal set to ${goal}ml`, 'green'));
    }

    setInterval(minutes: number): void {
        if (minutes <= 0) {
            console.log(c('❌ Interval must be positive!', 'red'));
            return;
        }
        this.interval = minutes;
        this._save();
        console.log(c(`✅ Reminder interval set to ${minutes} minutes`, 'green'));
    }

    remindNow(): void {
        console.log(c('\n💧 Time to drink some water! Stay hydrated!', 'cyan'));
        this.lastReminder = new Date().toISOString();
        this._save();
    }

    clearData(): void {
        this.rl.question('⚠️  Delete ALL data? (yes/no): ', (ans) => {
            if (ans.toLowerCase() === 'yes') {
                this.entries = [];
                this.goal = CONFIG.defaultGoal;
                this.interval = CONFIG.defaultInterval;
                this.lastReminder = null;
                this._save();
                console.log(c('🗑️  All data cleared.', 'yellow'));
            }
            this.rl.close();
        });
    }

    // ─── Menu ──────────────────────────────────────────────────────────────

    private _ask(prompt: string): Promise<string> {
        return new Promise(resolve => this.rl.question(prompt, resolve));
    }

    private async _askInt(prompt: string): Promise<number> {
        while (true) {
            const ans = await this._ask(prompt);
            const num = parseInt(ans.trim());
            if (!isNaN(num)) return num;
            console.log(c('❌ Please enter a number.', 'red'));
        }
    }

    private async _showMenu(): Promise<void> {
        const todayTotal = this._getTodayTotal();
        const progress = this._progressBar(todayTotal, this.goal);
        console.log('\n' + c('═'.repeat(50), 'cyan'));
        console.log(c('💧 WATER REMINDER', 'bright') + c('', 'cyan'));
        console.log(c('═'.repeat(50), 'cyan'));
        console.log(`  Today: ${todayTotal}ml / ${this.goal}ml  ${progress}`);
        console.log(`  Reminder: every ${this.interval} min`);
        console.log(c('─'.repeat(50), 'dim'));
        console.log('  1. 💧 Add water intake');
        console.log('  2. 📊 Today\'s progress');
        console.log('  3. 📈 Statistics');
        console.log(`  4. 🎯 Set daily goal (current: ${this.goal}ml)`);
        console.log(`  5. ⏰ Set reminder interval (current: ${this.interval} min)`);
        console.log('  6. 🔔 Check reminder now');
        console.log('  7. 🗑️  Clear all data');
        console.log('  0. 🚪 Exit');
        console.log(c('═'.repeat(50), 'cyan'));
    }

    async run(): Promise<void> {
        console.clear();
        console.log(c('\n💧 Water Reminder – Stay Hydrated!', 'bright') + c('', 'cyan'));
        console.log(c('Never forget to drink water again!', 'dim'));

        while (true) {
            await this._showMenu();
            const choice = await this._ask('Your choice: ');
            switch (choice.trim()) {
                case '1': {
                    const amount = await this._askInt('Amount in ml: ');
                    this.addEntry(amount);
                    break;
                }
                case '2': this.showToday(); break;
                case '3': this.showStats(); break;
                case '4': {
                    const goal = await this._askInt('New daily goal (ml): ');
                    this.setGoal(goal);
                    break;
                }
                case '5': {
                    const interval = await this._askInt('Interval (minutes): ');
                    this.setInterval(interval);
                    break;
                }
                case '6': this.remindNow(); break;
                case '7': this.clearData(); break;
                case '0':
                    console.log(c('👋 Stay hydrated! Goodbye!', 'cyan'));
                    this.rl.close();
                    return;
                default:
                    console.log(c('❌ Invalid choice.', 'red'));
            }
            if (choice !== '0') {
                console.log('\nPress Enter to continue...');
                await this._ask('');
            }
        }
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
    try {
        const app = new WaterReminder();
        await app.run();
    } catch (e: any) {
        console.error(c(`❌ Unexpected error: ${e.message}`, 'red'));
        process.exit(1);
    }
};

main();
