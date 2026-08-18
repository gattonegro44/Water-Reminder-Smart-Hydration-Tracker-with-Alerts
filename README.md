💧 Water Reminder – Smart Hydration Tracker with Alerts
"Never forget to drink again – smart reminders, daily goals, and beautiful progress charts!"

📋 Table of Contents
✨ Features

📁 Repository Structure

🚀 Quick Start

💻 Language Implementations

📊 Data Format

🤝 Contributing

📄 License

✨ Features
Feature	Description
💧 Log Intake	Add water consumption in ml with automatic timestamp
⏰ Smart Reminders	Set custom reminder intervals (minutes); get alerts when it's time to drink
🎯 Daily Goal	Set and track your personal hydration target (default 2000 ml)
📊 Progress View	See today's progress with a visual bar and percentage
📈 Statistics	View total, average, daily totals, and streak
💾 Persistence	All data and settings saved locally in JSON
🎨 Colorful CLI	Beautiful ANSI output with emojis and progress bars
⚡ Cross‑Platform	Works on Windows, macOS, and Linux
📁 Repository Structure
text
water-reminder/
├── README.md
├── python/
│   └── water_reminder.py
├── javascript/
│   └── water_reminder.js
├── typescript/
│   └── water_reminder.ts
├── go/
│   └── water_reminder.go
├── rust/
│   └── water_reminder.rs
├── cpp/
│   └── water_reminder.cpp
├── java/
│   └── WaterReminder.java
└── csharp/
    └── WaterReminder.cs
🚀 Quick Start
Prerequisites
Each language requires its respective runtime/compiler (see individual sections)

Clone & Run
bash
git clone https://github.com/yourusername/water-reminder.git
cd water-reminder
# Navigate to your language folder and run
💻 Language Implementations
1. 🐍 Python
bash
cd python
pip install rich
python water_reminder.py
Requires: Python 3.8+

2. 🟨 JavaScript (Node.js)
bash
cd javascript
node water_reminder.js
Requires: Node.js 16+

3. 🟦 TypeScript
bash
cd typescript
npm install -g ts-node
ts-node water_reminder.ts
Requires: Node.js 16+, TypeScript

4. 🟩 Go
bash
cd go
go run water_reminder.go
Requires: Go 1.18+

5. 🦀 Rust
bash
cd rust
cargo run
Requires: Rust 1.70+ (dependencies: serde, serde_json, chrono, colored)

6. ⚙️ C++
bash
cd cpp
g++ -std=c++17 water_reminder.cpp -o water_reminder
./water_reminder
Requires: C++17 compiler

7. ☕ Java
bash
cd java
javac WaterReminder.java
java WaterReminder
Requires: JDK 17+

8. 🔷 C#
bash
cd csharp
dotnet run
Requires: .NET 6.0+

📊 Data Format
All implementations use a unified JSON schema stored in ~/.water_reminder/data.json:

json
{
  "goal": 2000,
  "reminder_interval": 30,
  "last_reminder": "2026-08-18T08:30:00Z",
  "entries": [
    {
      "date": "2026-08-18",
      "amount": 250,
      "timestamp": "2026-08-18T08:15:00Z"
    }
  ]
}
🤝 Contributing
Contributions are welcome! Please:

Fork the repository

Create a feature branch

Commit your changes

Open a Pull Request

📄 License
MIT © 2026 Water Reminder Team
