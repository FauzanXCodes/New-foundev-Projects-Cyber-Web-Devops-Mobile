# Projects by Dart (language-learning-mini-app) — Setup & Test Workflow

This document covers how to install, run and test the four programs in this repository.

**This is not a mobile app.** There is no Android, no iOS, no Flutter UI, no `pubspec.yaml`,
no `package.json` and no build step. It is a small collection of **plain Dart console
programs** — four standalone `.dart` files, each with its own `main()`, each read from
`stdin` and printed to `stdout`. The repository is literally four folders with one file
each:

| Folder | File | Lines | What it is | Reads stdin? |
|---|---|---|---|---|
| `Quiz App/` | `Quiz App.dart` | 127 | A 5-question multiple-choice quiz with instant right/wrong feedback and a final score | **Yes** — 5 answers |
| `StopWatch App/` | `StopWatch App.dart` | 98 | A start / stop / reset stopwatch with a live seconds counter, driven by a text menu | **Yes** — menu choices |
| `To Do App (Dart Only)/` | `To Do App (Dart Only).dart` | 62 | Add / remove / view tasks in a terminal list | **Yes** — menu choices and task text |
| `school management project/` | `school management project.dart` | 170 | A pure OOP exercise: `Person` → `Student` / `Teacher`, plus `Course` and `School` | **No** — fully hard-coded |

**Honest scope note up front:** `project-metadata.json` claims the stack is *"Flutter; SQLite"*
and the goal is *"Vocabulary decks, quiz modes, streak and audio pronunciation via TTS."*
**All of that is wrong for this repository.** There is no Flutter, no SQLite, no TTS, no
vocabulary decks, no streak logic and no language-learning content. The only quiz is a
general-knowledge quiz about capitals, continents, Flutter, days-in-a-week and the colour of
the sky. The metadata's `entry` field — `Quiz App/Quiz App.dart` — *is* a real file and is a
reasonable starting point. The metadata also lists `"license": "Unknown"`, and that is
accurate: **there is no `LICENSE` file in this checkout** (only `README.md`,
`project-metadata.json` and the four folders).

**Honest scope note #2:** there is **no test suite, no CI and no build pipeline**. There are
no `*_test.dart` files, no `test/` directory, and `.github/` does not exist. Section 4 is
therefore manual: run each program, feed it input, check the output.

**Honest scope note #3 — the README mojibake:** `README.md` is a **valid UTF-8 file with LF
line endings and no BOM** (verified by reading its raw bytes — the first emoji is the correct
4-byte sequence `F0 9F 93 A6` for `📦`). The garbled text you may see is a **PowerShell 5.1
display artefact**, not corruption in the file: `Get-Content` without `-Encoding UTF8` reads
the file using the system ANSI code page and mangles every emoji. See 4.4. This is a
documentation/console cosmetic issue only — **it does not affect the Dart source**, and the
programs run perfectly.

---

### 1. Prerequisites

| Requirement | Version / detail | Checked with |
|---|---|---|
| OS | Windows 10/11 works. These are console programs with no platform-specific code | — |
| **Dart SDK** | **2.x or newer**; the code uses no modern-only syntax. Installed here: **Dart SDK 3.9.0 (stable, windows_x64)** | `dart --version` |
| **Where Dart comes from** | On this machine the Dart SDK is the one bundled with **Flutter 3.35.2** at `C:\Users\fauzan\Downloads\flutter_windows_3.35.2-stable\flutter\bin\dart.bat` — it is on `PATH`, so `dart` just works | `(Get-Command dart).Source` |
| A standalone Dart SDK | Perfectly fine and lighter — download from `dart.dev`. Not required | — |
| **Flutter** | **Not needed.** None of these programs imports `package:flutter` or `dart:ui`. Flutter is present on this machine only because it supplies the Dart SDK | `flutter --version` |
| Node.js / npm / Composer | **Not needed** — no `package.json` exists | `Test-Path package.json` |
| A terminal | Any. These are interactive console programs; run them in a window where you can type | — |

**No installation step exists.** There is nothing to `pub get`, no `pubspec.yaml`, no
`package.json`, no `node_modules`. You clone the folder and run the files.

Project root used by every command below:

```powershell
$root = "N:\Foundev-Projects\Domain\Mobile App Development\language-learning-mini-app"
Set-Location $root
```

---

### 2. Installation and Setup

#### 2.1 Confirm the Dart SDK is available

```powershell
dart --version
```

Verified output on this machine:

```
Dart SDK version: 3.9.0 (stable) (Mon Aug 11 07:58:10 2025 -0700) on "windows_x64"
```

If `dart` is not recognised, either install the standalone Dart SDK or add Flutter's `bin`
folder to `PATH`:

```powershell
$env:Path += ";C:\Users\fauzan\Downloads\flutter_windows_3.35.2-stable\flutter\bin"
dart --version
```

#### 2.2 Confirm there is nothing to install

```powershell
Get-ChildItem -LiteralPath $root -Force | Select-Object Mode, Name
```

Verified output:

```
Mode   Name
----   ----
d----- Quiz App
d----- school management project
d----- StopWatch App
d----- To Do App (Dart Only)
-a---- project-metadata.json
-a---- README.md
```

There is **no `pubspec.yaml`**, so `dart pub get` is meaningless here, and there is **no
`package.json`**, so `npm install` is meaningless here.

#### 2.3 The file names contain spaces (and parentheses) — always quote them

Every path below has at least one space in it, and the To Do file also has parentheses.
**Always wrap the path in double quotes**, otherwise PowerShell splits it into several
arguments:

```powershell
# WRONG - will fail
dart Quiz App\Quiz App.dart

# RIGHT
dart "Quiz App\Quiz App.dart"
```

Two equivalent invocation forms work:

| Form | Notes |
|---|---|
| `dart "path\to\file.dart"` | Runs the script directly. Simplest. |
| `dart run "path\to\file.dart"` | The documented "run a single file" form. Same behaviour here. |

Both were exercised on this machine while writing this document.

#### 2.4 Files you will interact with

| File | Key details |
|---|---|
| `Quiz App/Quiz App.dart` | 5 hard-coded questions. Answer keys: Q1 `3` (Paris), Q2 `3` (7 continents), Q3 `1` (Dart), Q4 `4` (7 days), Q5 `2` (Blue). Reads with `stdin.readLineSync()!` and compares the **raw string** to the key. Scoring: 5 → *"Excellent!"*, ≥3 → *"Good job!"*, otherwise *"Better luck next time!"*. |
| `StopWatch App/StopWatch App.dart` | Menu: `1` start, `2` stop, `3` reset, `4` exit. Uses `Timer.periodic(Duration(seconds: 1))` and reads stdin asynchronously via `stdin.transform(utf8.decoder).transform(LineSplitter()).listen(...)`. Contains Arabic comments (valid UTF-8). |
| `To Do App (Dart Only)/To Do App (Dart Only).dart` | Menu: `1` add, `2` remove, `3` view, `4` exit, in a `do…while` loop. Reads the menu choice with `int.parse(stdin.readLineSync()!)`. |
| `school management project/school management project.dart` | No input at all. Creates 5 teachers, 10 students, 5 courses, enrols students and prints everything. Classes: `Person` (base), `Student`, `Teacher` (both `extends Person`), `Course`, `School`. |

#### 2.5 Nothing else to configure

There is no configuration file, no environment variable, no database and no API key. The
programs are self-contained.

---

### 3. Launch the Complete Project

Each program is a **separate, independent executable**. There is no single "run the app"
command — you launch whichever one you want, one at a time.

#### 3.1 Quiz App

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\language-learning-mini-app"
dart "Quiz App\Quiz App.dart"
```

It prints the banner and the first question, then waits for input five times:

```
====================
Welcome to Quiz App!
====================
You will be asked some questions with multiple choices.
Type the correct option number to answer.

Q1: What is the capital of France?
1) Berlin
2) Madrid
3) Paris
4) Rome
Answer between (1 t0 4):
```

(Note the typo `t0` for `to` — that is in the source, not in this document.)

Type `3`, `Enter`, `4`, `Enter`, and so on. At the end it prints the score band and
`Good Bye!`.

#### 3.2 StopWatch App

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\language-learning-mini-app"
dart "StopWatch App\StopWatch App.dart"
```

```
==========================
Welcome to StopWatch App!
==========================

Choose an option:
1) Start Stopwatch
2) Stop Stopwatch
3) Reset Stopwatch
4) Exit
==========================
Enter choice:
```

The menu is re-printed after every action. `1` starts a one-second `Timer.periodic` that
prints `Stopwatch: N s`; `2` stops it; `3` resets the counter to 0; `4` prints `Goodbye!` and
calls `exit(0)`.

#### 3.3 To Do App

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\language-learning-mini-app"
dart "To Do App (Dart Only)\To Do App (Dart Only).dart"
```

```
-----To Do App-----
1. Add Task
2. Remove Task
3. View Tasks
4. Exit
Enter Your Choice:
```

`1` prompts for the task text and appends it to a `List<String>`; `2` asks for a 1-based task
number and removes it; `3` prints the list; `4` leaves the `do…while` loop (the loop
condition is `ch > 0 && ch < 4`).

#### 3.4 School Management (no input required)

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\language-learning-mini-app"
dart "school management project\school management project.dart"
```

It runs to completion on its own and prints 69 lines: every `Added Teacher/Student/Course`
line, every `enrolled in` line, the school summary (`School: Future School / Students: 10 /
Teachers: 5 / Courses: 5`) and then each course's teacher and student list.

#### 3.5 Ports

**None.** These are console programs — they open no sockets, bind no ports and serve
nothing.

| Component | Port | Notes |
|---|---|---|
| Quiz App / StopWatch App / To Do App / School Management | **none** | Console I/O only: stdin → stdout |
| Dart VM | **none** | No dev server, no debugger port (unless you attach one explicitly) |

---

### 4. Test the Project

> **There is no automated test suite.** No `*_test.dart` files, no `test/` directory, no
> `dart test` target, no CI. Everything below is either the Dart SDK's own static analyser or
> a manual run.

#### 4.1 Static analysis — verified passing here

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\language-learning-mini-app"
dart analyze
```

Verified output on this machine (exit code `0`):

```
Analyzing language-learning-mini-app...
No issues found!
```

This command creates no files — `Test-Path .dart_tool` is still `False` afterwards.

#### 4.2 Running each program with scripted input

Because three of the four programs read from `stdin`, you can drive them from a pipeline
instead of typing. This is how each was verified while writing this document.

**Quiz App — all five answers correct (verified, exit code 0):**

```powershell
Set-Location "N:\Foundev-Projects\Domain\Mobile App Development\language-learning-mini-app"
"3`n3`n1`n4`n2" | dart "Quiz App\Quiz App.dart"
```

Tail of the verified output:

```
=============
Final Result!
=============
Excellent!
=============
Good Bye!
=============
```

(The backtick-n `` `n `` is PowerShell's newline escape inside a double-quoted string.)

**StopWatch App — start, wait, stop, exit (verified, exit code 0):**

```powershell
"1`n2`n4" | dart "StopWatch App\StopWatch App.dart"
```

Verified output ends with `Stopwatch stopped at 0 s` (the pipe delivers all three lines at
once, so the timer is cancelled before its first tick) followed by `Goodbye!`.

**To Do App — add, remove, view, exit (verified, exit code 0):**

```powershell
"1`nBuy milk`n2`n1`n3`n4" | dart "To Do App (Dart Only)\To Do App (Dart Only).dart"
```

Verified output shows `Task Add To A list Sucessfully!`, then `List = [Buy milk]`, then
`Task Remove Sucessfully!!!`, then `Your Tasks : []`, then the final menu.

**School Management — no input (verified, exit code 0, 69 lines of output):**

```powershell
dart "school management project\school management project.dart"
```

#### 4.3 Known crash: the To Do App dies on non-numeric input

`To Do App (Dart Only).dart` reads its menu choice with `int.parse(stdin.readLineSync()!)`
and does **not** guard it. Verified:

```powershell
"abc" | dart "To Do App (Dart Only)\To Do App (Dart Only).dart"
```

```
dart : Unhandled exception:

FormatException: Invalid radix-10 number (at character 1)
abc
^
#0      int._handleFormatError (dart:core-patch/integers_patch.dart:137:5)
#1      int._parseRadix (dart:core-patch/integers_patch.dart:155:16)
```

The same unguarded `int.parse` is used for the "Enter Task Number" prompt, so a non-numeric
answer there crashes it too. **This is a bug in the program, not a setup problem.** It is
documented rather than fixed, because this workflow describes the code as shipped.

#### 4.4 Reading the README without mojibake

`README.md` is valid UTF-8. PowerShell 5.1's `Get-Content` defaults to the system ANSI code
page, so the emoji are mangled. Verified side by side:

```powershell
# WRONG - default ANSI decoding, mojibake
Get-Content -LiteralPath "$root\README.md" -TotalCount 12
```

```
# dY"� Projects by Dart

A collection of simple **Dart console applications** dYZ_.
...
### 1�,?��� dY"? Quiz App
```

```powershell
# RIGHT - explicit UTF-8
Get-Content -LiteralPath "$root\README.md" -Encoding UTF8 -TotalCount 12
```

```
# 📦 Projects by Dart

A collection of simple **Dart console applications** 🎯.
...
### 1️⃣ 📝 Quiz App
```

In **PowerShell 7+** `Get-Content` defaults to UTF-8 and the problem disappears. In an editor
(VS Code, Notepad++) the file also displays correctly. **Nothing is wrong with the file and
nothing needs fixing** — it is purely a console-decoding cosmetic issue.

#### 4.5 Manual functional checklist for each program

**Quiz App**

- [ ] The banner and `Q1` are printed before the first prompt
- [ ] Answering `3` prints `Correct Answer.`; answering `1` prints
      `Wrong Answer!! The Correct Answer Is Paris.`
- [ ] All five questions are asked in order
- [ ] The final band is `Excellent!` (5/5), `Good job!` (3–4) or `Better luck next time!`
      (0–2)
- [ ] `Good Bye!` is printed and the process exits with code `0`

**StopWatch App**

- [ ] The menu is printed once at startup and re-printed after every action
- [ ] `1` starts the counter and `Stopwatch: N s` is printed once per second
- [ ] `2` stops it and prints `Stopwatch stopped at N s`
- [ ] `2` on a non-running stopwatch prints `Stopwatch is not running!`
- [ ] `3` prints `Stopwatch reset to 0!`
- [ ] `4` prints `Goodbye!` and exits with code `0`
- [ ] Any other input prints `Invalid Number...Try Again!!!`

**To Do App**

- [ ] `1` then a task name adds it and prints `Task Add To A list Sucessfully!`
- [ ] `2` on an empty list prints `Tasks list is Empty!!!`
- [ ] `2` with a number outside the range prints `Invalid Number!!! Please , Enter a Number again:`
- [ ] `3` prints `Your Tasks : [...]`
- [ ] `4` exits the loop with code `0`

**School Management**

- [ ] 5 `Added Teacher` lines, then 10 `Added Student` lines
- [ ] 5 `Added Course` lines, then 10 `... enrolled in ...` lines
- [ ] `School: Future School / Students: 10 / Teachers: 5 / Courses: 5`
- [ ] Each of the 5 courses prints `Course :`, `Teacher :` and its student list
- [ ] The process exits with code `0`

---

### 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `dart` is not recognised as a command | The Dart SDK is not on `PATH` | Add the SDK's `bin` folder to `$env:Path`, or install the standalone SDK from dart.dev |
| `dart : The term 'dart' is not recognized…` on the To Do folder | You forgot the quotes around the path | `dart "To Do App (Dart Only)\To Do App (Dart Only).dart"` |
| `Could not find a file named "Quiz App\Quiz App.dart"` | Unquoted path split on the space | Quote it |
| `Error: The argument 'App' isn't a valid Dart file` | Same as above — PowerShell passed `App` as a separate argument | Quote it |
| `dart pub get` fails / says there is no `pubspec.yaml` | **This project has no pubspec.** It is a set of standalone scripts, not a package | Don't run `pub get`; there are no dependencies to fetch |
| `flutter pub get` fails | Same reason | Don't run it — and Flutter is not required at all |
| `dart analyze` says "No issues found" but `dart run` still fails | Static analysis does not execute the program | Run the program and supply input (4.2) |
| The Quiz App immediately prints the final result with no questions | `stdin` was closed/redirected to an empty source, so every `readLineSync()!` returned null and the program threw at the first `!` | Supply five lines of input (4.2) |
| The StopWatch App's counter never ticks | Piped input arrives faster than the 1-second timer; the timer is cancelled before its first tick | Type the input interactively instead of piping it |
| The To Do App throws `FormatException: Invalid radix-10 number` | Unguarded `int.parse` on the menu choice — a **bug in the program** (4.3) | Type `1`–`4` only |
| The To Do App exits after the first choice | Choice `4` ends the `do…while` loop; that is intended | — |
| The README's emojis look like `dY"�` | PowerShell 5.1 decoded UTF-8 as ANSI | `Get-Content -Encoding UTF8`, or use PowerShell 7+ (4.4) |
| The StopWatch file shows `����` where the Arabic comments should be | Same decoding issue, this time in the editor/console | Open the file as UTF-8 |
| `dart analyze` reports `Target of URI doesn't exist: 'dart:io'` | You are running an old Dart SDK (pre-2.10) or an editor with no SDK configured | `dart --version`; upgrade the SDK |
| Nothing happens after `dart "…"` and the prompt returns instantly | The program read EOF from stdin and exited | Run it interactively, or pipe input as in 4.2 |

**Known limitations to state honestly**

* **Not a mobile app.** No Android, no iOS, no Flutter, no SQLite, no TTS, no vocabulary
  decks, no streaks. `project-metadata.json`'s `"stack": "Flutter; SQLite"` and its goal
  string are **wrong** about this repository.
* **No automated tests and no CI.** There are no `*_test.dart` files, no `test/` directory
  and no `.github/` folder. The only machine-checkable thing is `dart analyze`.
* **These are teaching-exercise scripts.** The programs are ~60–170 lines each, they print
  ASCII menus, and several contain typos that are baked into the source: `Answer between (1
  t0 4)`, `Task Add To A list Sucessfully!`, `Correct Answer Is 7.` (for the seven-days
  question, whose answer is `4`), `Better luck next time!`.
* **The To Do App crashes on any non-numeric input** — verified, see 4.3. Not fixed here.
* **The Quiz App is fixed-content.** There is no question bank, no persistence, no scoring
  across runs and no way to change the questions without editing the source.
* **The StopWatch App is not a real stopwatch.** It counts whole seconds only (no
  milliseconds) and it does not keep running while the program is closed.
* **The School Management app is entirely hard-coded.** Five teachers, ten students and five
  courses are created in `main()`; there is no input, no persistence and no way to change
  the data without editing the source.
* **No persistence anywhere.** Nothing is written to disk; every run starts from scratch.
* **No `LICENSE` file.** `project-metadata.json` says `"license": "Unknown"`, and that is
  correct — the upstream repository `github.com/SalahHassan202/projects_by_dart` is where
  the terms would come from; this checkout does not include a licence text.
* **The README's "Created By" line credits "Salah Hassan – Flutter Developer"**, but no
  Flutter code is present in the repository.

---

### 6. Verification Checklist

Tick each box only once **you** have observed the result. Nothing below is pre-claimed.

**Environment**

- [ ] `dart --version` prints a Dart SDK version (2.x or newer)
- [ ] `Get-Command dart` shows a path on this machine
- [ ] You have confirmed there is **no** `pubspec.yaml` and **no** `package.json`, so there is
      nothing to install
- [ ] `Get-ChildItem $root -Force` lists exactly the four program folders plus
      `README.md` and `project-metadata.json`

**Static check**

- [ ] `dart analyze` prints `No issues found!` and exits `0`
- [ ] `dart analyze` created no `.dart_tool/` folder

**Quiz App**

- [ ] `dart "Quiz App\Quiz App.dart"` starts and prints the banner and `Q1`
- [ ] All five questions are asked in order
- [ ] Answering `3` for Q1 prints `Correct Answer.`
- [ ] The final band matches your score (`Excellent!` / `Good job!` / `Better luck next
      time!`)
- [ ] `Good Bye!` is printed and the exit code is `0`

**StopWatch App**

- [ ] `dart "StopWatch App\StopWatch App.dart"` prints the menu and the `Enter choice:`
      prompt
- [ ] `1` starts the counter and `Stopwatch: N s` is printed once per second
- [ ] `2` stops it, `3` resets it, `4` prints `Goodbye!` and exits with code `0`

**To Do App**

- [ ] `dart "To Do App (Dart Only)\To Do App (Dart Only).dart"` prints the four-item menu
- [ ] `1` adds a task and `3` shows it in the list
- [ ] `2` removes a task by its 1-based number
- [ ] `2` on an empty list prints `Tasks list is Empty!!!`
- [ ] You have seen (and understood) the `FormatException` crash on non-numeric input
- [ ] `4` exits with code `0`

**School Management**

- [ ] `dart "school management project\school management project.dart"` runs to completion
      with no input and exits with code `0`
- [ ] The output contains 5 teachers, 10 students, 5 courses and 10 enrolments
- [ ] The summary reads `School: Future School`, `Students: 10`, `Teachers: 5`, `Courses: 5`
- [ ] Each course prints its teacher and student list

**Documentation**

- [ ] You can read `README.md` cleanly with `Get-Content -Encoding UTF8` (or in an editor)
- [ ] You understand that the mojibake is a PowerShell console-decoding artefact and that the
      file itself is valid UTF-8

**Cleanup**

- [ ] No background processes are left running
- [ ] `git status` shows no unintended files added to the repository
