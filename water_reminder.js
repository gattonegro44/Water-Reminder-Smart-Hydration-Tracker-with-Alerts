# water_reminder.js
/**
 * 💧 Water Reminder – Smart Hydration Tracker with Alerts (Node.js Edition)
 * Features: add intake, daily goal, configurable reminders, stats, persistence, colored UI
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

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

const c = (str, color) => `${color}${str}${colors.reset}`;

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG = {
    dataDir: path.join(os.homedir(), '.water_reminder'),
    dataFile: 'data.json',
    defaultGoal: 2000,
    defaultInterval: 30,
};

// ─── Data Manager ──────────────────────────────────────────────────────────

class WaterReminder {
    constructor() {
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        this.data = this._load();
        this.goal = this.data.goal || CONFIG.defaultGoal;
        this.interval = this.data.reminder_interval || CONFIG.defaultInterval;
        this.lastReminder = this.data.last_reminder || null;
        this.entries = this.data.entries || [];
        this._checkReminder();
        // Set up periodic reminder check every 60 seconds
        setInterval(() => this._checkReminder(), 60000);
    }

    _getDataPath() {
        if (!fs.existsSync(CONFIG.dataDir)) fs.mkdirSync(CONFIG.dataDir, { recursive: true });
        return path.join(CONFIG.dataDir, CONFIG.dataFile);
    }

    _load() {
        const file = this._getDataPath();
        if (fs.existsSync(file)) {
            try {
                return JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (_) { return {}; }
        }
        return {};
    }

    _save() {
        const data = {
            goal: this.goal,
            reminder_interval: this.interval,
            last_reminder: this.lastReminder,
            entries: this.entries
        };
        fs.writeFileSync(this._getDataPath(), JSON.stringify(data, null, 2));
    }

    _today() {
        return new Date().toISOString().split('T')[0];
    }

    _getTodayEntries() {
        const today = this._today();
        return this.entries.filter(e => e.date === today);
    }

    _getTodayTotal() {
        return this._getTodayEntries().reduce((s, e) => s + e.amount, 0);
    }

    _progressBar(current, goal, width = 20) {
        if (goal <= 0) return '⚠️  Goal not set';
        const ratio = Math.min(current / goal, 1);
        const filled = Math.floor(ratio * width);
        return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(ratio * 100).toFixed(1)}%`;
    }

    _checkReminder() {
        if (!this.lastReminder) {
            this.lastReminder = new Date().toISOString();
            this._save();
            return;
        }
        const last = new Date(this.lastReminder);
        const now = new Date();
        const elapsed = (now - last) / 60000; // minutes
        if (elapsed >= this.interval) {
            console.log(c('\n⏰ Time to drink water! (${this.interval} min since last reminder)', 'cyan'));
            this.lastReminder = now.toISOString();
            this._save();
        }
    }

    // ─── Core Actions ──────────────────────────────────────────────────────

    addEntry(amount) {
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

    showToday() {
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

    showStats() {
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

    setGoal(goal) {
        if (goal <= 0) {
            console.log(c('❌ Goal must be positive!', 'red'));
            return;
        }
        this.goal = goal;
        this._save();
        console.log(c(`✅ Daily goal set to ${goal}ml`, 'green'));
    }

    setInterval(minutes) {
        if (minutes <= 0) {
            console.log(c('❌ Interval must be positive!', 'red'));
            return;
        }
        this.interval = minutes;
        this._save();
        console.log(c(`✅ Reminder interval set to ${minutes} minutes`, 'green'));
    }

    remindNow() {
        console.log(c('\n💧 Time to drink some water! Stay hydrated!', 'cyan'));
        this.lastReminder = new Date().toISOString();
        this._save();
    }

    clearData() {
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

    _ask(prompt) {
        return new Promise(resolve => this.rl.question(prompt, resolve));
    }

    async _askInt(prompt) {
        while (true) {
            const ans = await this._ask(prompt);
            const num = parseInt(ans.trim());
            if (!isNaN(num)) return num;
            console.log(c('❌ Please enter a number.', 'red'));
        }
    }

    async _showMenu() {
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

    async run() {
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

const main = async () => {
    try {
        const app = new WaterReminder();
        await app.run();
    } catch (e) {
        console.error(c(`❌ Unexpected error: ${e.message}`, 'red'));
        process.exit(1);
    }
};

main();
