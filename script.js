"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const $ = id => document.getElementById(id);

    const DAYS = [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday"
    ];

    const KEYS = {
        tasks: "studyflow-tasks-v1",
        schedule: "studyflow-weekly-schedule-v1",
        focus: "studyflow-focus-stats-v1",
        subjects: "studyflow-subjects-v1",
        goals: "studyflow-daily-goals-v1",
        streak: "studyflow-streak-v1",
        theme: "studyflow-theme-v1"
    };

    function load(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            console.error("StudyFlow storage error:", error);
            return fallback;
        }
    }

    function save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("StudyFlow save error:", error);
            return false;
        }
    }

    function makeId() {
        return Date.now().toString(36) +
            Math.random().toString(36).slice(2);
    }

    function localDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatTime(time) {
        if (!time) return "";

        const [hours, minutes] = time.split(":").map(Number);
        const date = new Date();

        date.setHours(hours, minutes, 0, 0);

        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function formatClock(seconds) {
        seconds = Math.max(0, Math.ceil(seconds));

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return String(minutes).padStart(2, "0") + ":" +
            String(remainingSeconds).padStart(2, "0");
    }

    function message(id, text) {
        const element = $(id);

        if (element) {
            element.textContent = text;
        }
    }

    /* =====================================
       DATE AND CLOCK
    ===================================== */

    const quotes = [
        "You don't have to bloom all at once.",
        "Small steps still take you somewhere lovely.",
        "Rest is part of the process, too.",
        "You are allowed to learn at your own pace.",
        "A little progress is still progress."
    ];

    function updateClock() {
        const now = new Date();

        if ($("todayDate")) {
            $("todayDate").textContent =
                now.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric"
                }) + " 🌱";
        }

        if ($("clock")) {
            $("clock").textContent =
                now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                });
        }

        if ($("dailyQuote")) {
            $("dailyQuote").textContent =
                quotes[now.getDate() % quotes.length];
        }
    }

    updateClock();
    setInterval(updateClock, 1000);

    /* =====================================
       TASK MANAGER
    ===================================== */

    let tasks = load(KEYS.tasks, []);

    if (!Array.isArray(tasks)) tasks = [];

    tasks = tasks.map(task => ({
        id: String(task.id || makeId()),
        text: String(task.text || ""),
        completed: Boolean(task.completed),
        subject: task.subject || "General",
        durationSeconds: Number(task.durationSeconds) || 1500,
        remainingSeconds: Number(task.remainingSeconds) || 0,
        timerRunning: false,
        timerDeadline: null
    })).filter(task => task.text);

    tasks.forEach(task => {
        if (task.remainingSeconds <= 0 && !task.completed) {
            task.remainingSeconds = task.durationSeconds;
        }
    });

    const taskForm = $("taskForm");
    const taskInput = $("taskInput");
    const taskDuration = $("taskDuration");
    const taskList = $("taskList");
    const taskFilter = $("taskFilter");

    function saveTasks() {
        save(KEYS.tasks, tasks);
    }

    function pauseTaskTimer(task) {
        if (task.timerRunning && task.timerDeadline) {
            task.remainingSeconds = Math.max(
                0,
                Math.ceil((task.timerDeadline - Date.now()) / 1000)
            );
        }

        task.timerRunning = false;
        task.timerDeadline = null;
    }

    function renderTasks() {
        if (!taskList) return;

        taskList.replaceChildren();

        const filter = taskFilter ? taskFilter.value : "all";

        const visibleTasks = tasks.filter(task => {
            if (filter === "active") return !task.completed;
            if (filter === "completed") return task.completed;

            return true;
        });

        if ($("emptyState")) {
            $("emptyState").style.display =
                tasks.length === 0 ? "block" : "none";
        }

        visibleTasks.forEach(task => {
            const item = document.createElement("li");

            item.className =
                "task-item" + (task.completed ? " is-complete" : "");

            const checkbox = document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.className = "task-checkbox";
            checkbox.checked = task.completed;

            checkbox.addEventListener("change", function () {
                task.completed = checkbox.checked;

                if (task.completed) {
                    pauseTaskTimer(task);
                    recordStudyActivity();
                }

                saveTasks();
                renderTasks();
                updateTaskStats();
                updateGoalsDisplay();
            });

            const name = document.createElement("span");

            name.className = "task-name";
            name.textContent = task.text;

            const subjectLabel = document.createElement("span");

            subjectLabel.className = "task-subject-label";
            subjectLabel.textContent =
                task.subject !== "General" ? "📚 " + task.subject : "";

            const deleteButton = document.createElement("button");

            deleteButton.type = "button";
            deleteButton.className = "delete-task";
            deleteButton.textContent = "×";
            deleteButton.setAttribute("aria-label", "Delete task");

            deleteButton.addEventListener("click", function () {
                tasks = tasks.filter(item => item.id !== task.id);

                saveTasks();
                renderTasks();
                updateTaskStats();
                updateGoalsDisplay();
            });

            const timer = document.createElement("div");
            timer.className = "task-timer";

            const timerText = document.createElement("span");

            timerText.className = "task-timer-time";
            timerText.id = "task-time-" + task.id;

            const track = document.createElement("div");
            track.className = "task-timer-track";

            const fill = document.createElement("div");

            fill.className = "task-timer-fill";
            fill.id = "task-fill-" + task.id;

            track.appendChild(fill);

            const timerButton = document.createElement("button");

            timerButton.type = "button";
            timerButton.className = "task-timer-button";

            timerButton.addEventListener("click", function () {
                if (task.timerRunning) {
                    pauseTaskTimer(task);
                } else {
                    tasks.forEach(other => {
                        if (other.id !== task.id) {
                            pauseTaskTimer(other);
                        }
                    });

                    if (task.remainingSeconds <= 0) {
                        task.remainingSeconds = task.durationSeconds;
                    }

                    task.timerRunning = true;
                    task.timerDeadline =
                        Date.now() + task.remainingSeconds * 1000;
                }

                saveTasks();
                renderTasks();
            });

            const resetButton = document.createElement("button");

            resetButton.type = "button";
            resetButton.className = "task-timer-button reset";
            resetButton.textContent = "Reset";

            resetButton.addEventListener("click", function () {
                task.timerRunning = false;
                task.timerDeadline = null;
                task.remainingSeconds = task.durationSeconds;

                saveTasks();
                renderTasks();
            });

            timer.append(timerText, track, timerButton, resetButton);

            item.append(checkbox, name, deleteButton);

            if (subjectLabel.textContent) {
                item.appendChild(subjectLabel);
            }

            item.appendChild(timer);
            taskList.appendChild(item);

            function updateTimer() {
                timerText.textContent =
                    task.remainingSeconds <= 0
                        ? "Time's up!"
                        : formatClock(task.remainingSeconds);

                fill.style.width =
                    Math.max(
                        0,
                        task.remainingSeconds / task.durationSeconds * 100
                    ) + "%";

                timerButton.textContent =
                    task.timerRunning ? "Pause" : "Start";

                timerButton.disabled = task.completed;
            }

            updateTimer();
        });

        if ($("taskCountBadge")) {
            $("taskCountBadge").textContent =
                tasks.length + (tasks.length === 1 ? " task" : " tasks");
        }
    }

    function updateTaskStats() {
        const total = tasks.length;
        const completed = tasks.filter(task => task.completed).length;
        const remaining = total - completed;

        const percent = total
            ? Math.round(completed / total * 100)
            : 0;

        if ($("totalTasks")) $("totalTasks").textContent = total;
        if ($("completedTasks")) $("completedTasks").textContent = completed;
        if ($("remainingTasks")) $("remainingTasks").textContent = remaining;

        if ($("progressPercent")) {
            $("progressPercent").textContent = percent + "%";
        }

        if ($("progressFill")) {
            $("progressFill").style.width = percent + "%";
        }

        if ($("progressTrack")) {
            $("progressTrack").setAttribute("aria-valuenow", percent);
        }

        if ($("progressMessage")) {
            $("progressMessage").textContent =
                percent === 100 && total > 0
                    ? "You did it! Make room to celebrate. 🌷"
                    : "Every little step counts. Keep going gently. ♡";
        }

        if ($("tasksRingValue")) {
            $("tasksRingValue").textContent = percent + "%";
        }

        if ($("tasksRingCaption")) {
            $("tasksRingCaption").textContent =
                completed + " of " + total + " complete";
        }

        updateRing("tasksRing", percent);
    }

    if (taskForm) {
        taskForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const text = taskInput ? taskInput.value.trim() : "";

            if (!text) {
                message("formMessage", "Please enter a task first.");
                return;
            }

            const duration = taskDuration
                ? Number(taskDuration.value) || 1500
                : 1500;

            tasks.push({
                id: makeId(),
                text,
                completed: false,
                subject: $("taskSubject")
                    ? $("taskSubject").value
                    : "General",
                durationSeconds: duration,
                remainingSeconds: duration,
                timerRunning: false,
                timerDeadline: null
            });

            saveTasks();

            taskInput.value = "";

            message("formMessage", "Task added successfully! ✨");

            renderTasks();
            updateTaskStats();
            updateGoalsDisplay();
        });
    }

    if (taskFilter) {
        taskFilter.addEventListener("change", renderTasks);
    }

    if ($("clearCompletedBtn")) {
        $("clearCompletedBtn").addEventListener("click", function () {
            tasks = tasks.filter(task => !task.completed);

            saveTasks();
            renderTasks();
            updateTaskStats();
            updateGoalsDisplay();

            message("formMessage", "Completed tasks cleared.");
        });
    }

    setInterval(function () {
        let changed = false;

        tasks.forEach(task => {
            if (!task.timerRunning || !task.timerDeadline) return;

            task.remainingSeconds = Math.max(
                0,
                Math.ceil((task.timerDeadline - Date.now()) / 1000)
            );

            changed = true;

            if (task.remainingSeconds <= 0) {
                task.timerRunning = false;
                task.timerDeadline = null;

                message("formMessage", "Timer finished! Take a little break. 🌿");
            }
        });

        if (changed) {
            saveTasks();
            renderTasks();
        }
    }, 1000);

    /* =====================================
       PROGRESS RINGS
    ===================================== */

    function updateRing(id, percentage) {
        const ring = $(id);

        if (!ring) return;

        const circumference = 2 * Math.PI * 50;

        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset =
            circumference * (1 - Math.max(0, Math.min(100, percentage)) / 100);
    }

    /* =====================================
       POMODORO FOCUS TIMER
    ===================================== */

    const modes = {
        focus: { seconds: 1500, next: "short" },
        short: { seconds: 300, next: "focus" },
        long: { seconds: 900, next: "focus" }
    };

    let currentMode = "focus";
    let remaining = modes.focus.seconds;
    let running = false;
    let deadline = null;

    const today = localDateKey();

    let focusStats = load(KEYS.focus, {
        date: today,
        focusMinutes: 0,
        sessions: 0
    });

    if (!focusStats || focusStats.date !== today) {
        focusStats = {
            date: today,
            focusMinutes: 0,
            sessions: 0
        };
    }

    function renderPomodoro() {
        if ($("pomodoroTime")) {
            $("pomodoroTime").textContent = formatClock(remaining);
        }

        if ($("pomodoroStart")) {
            $("pomodoroStart").textContent =
                running ? "Pause" : "Start focus";
        }

        const progress =
            (modes[currentMode].seconds - remaining) /
            modes[currentMode].seconds * 100;

        updateRing("pomodoroRing", progress);
        updateRing("breakRing", progress);

        if ($("focusRingValue")) {
            $("focusRingValue").textContent =
                focusStats.focusMinutes + "m";
        }

        if ($("sessionsRingValue")) {
            $("sessionsRingValue").textContent =
                focusStats.sessions + "/4";
        }

        updateRing(
            "focusRing",
            Math.min(100, focusStats.focusMinutes)
        );

        updateRing(
            "sessionsRing",
            Math.min(100, focusStats.sessions / 4 * 100)
        );

        document.querySelectorAll(".pomodoro-mode").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.mode === currentMode
            );
        });
    }

    function chooseMode(mode) {
        if (!modes[mode]) return;

        running = false;
        deadline = null;
        currentMode = mode;
        remaining = modes[mode].seconds;

        renderPomodoro();
    }

    document.querySelectorAll(".pomodoro-mode").forEach(button => {
        button.addEventListener("click", function () {
            chooseMode(button.dataset.mode);
        });
    });

    if ($("pomodoroStart")) {
        $("pomodoroStart").addEventListener("click", function () {
            if (running) {
                remaining = Math.max(
                    0,
                    Math.ceil((deadline - Date.now()) / 1000)
                );

                running = false;
                deadline = null;
            } else {
                if (remaining <= 0) {
                    remaining = modes[currentMode].seconds;
                }

                running = true;
                deadline = Date.now() + remaining * 1000;
            }

            renderPomodoro();
        });
    }

    if ($("pomodoroReset")) {
        $("pomodoroReset").addEventListener("click", function () {
            chooseMode(currentMode);
        });
    }

    if ($("pomodoroSkip")) {
        $("pomodoroSkip").addEventListener("click", function () {
            chooseMode(modes[currentMode].next);
        });
    }

    setInterval(function () {
        if (!running || !deadline) return;

        remaining = Math.max(
            0,
            Math.ceil((deadline - Date.now()) / 1000)
        );

        if (remaining <= 0) {
            running = false;
            deadline = null;

            if (currentMode === "focus") {
                focusStats.focusMinutes += 25;
                focusStats.sessions += 1;

                save(KEYS.focus, focusStats);

                recordStudyActivity();
                updateGoalsDisplay();

                message(
                    "pomodoroStatus",
                    "Focus session complete! Time for a little break. 🌷"
                );

                chooseMode("short");
            } else {
                message(
                    "pomodoroStatus",
                    "Break finished. Ready when you are! ✨"
                );

                chooseMode("focus");
            }
        }

        renderPomodoro();
    }, 1000);

    /* =====================================
       WEEKLY SCHEDULE
    ===================================== */

    let schedule = load(KEYS.schedule, []);

    if (!Array.isArray(schedule)) schedule = [];

    const scheduleForm = $("scheduleForm");
    const eventTitle = $("eventTitle");
    const eventDay = $("eventDay");
    const eventStart = $("eventStart");
    const eventEnd = $("eventEnd");
    const eventType = $("eventType");
    const weekDays = $("weekDays");
    const dailyAgenda = $("dailyAgenda");
    const upcomingEvents = $("upcomingEvents");

    let activeDay = DAYS[(new Date().getDay() + 6) % 7];

    function saveSchedule() {
        return save(KEYS.schedule, schedule);
    }

    function typeLabel(type) {
        const labels = {
            class: "📚 Class",
            study: "✍️ Study session",
            assignment: "📝 Assignment",
            break: "🌿 Break",
            other: "✨ Other"
        };

        return labels[type] || "✨ Other";
    }

    function createScheduleCard(item, dayLabel = "") {
        const card = document.createElement("article");
        card.className = "schedule-event";

        const details = document.createElement("div");
        details.className = "event-details";

        const title = document.createElement("h4");
        title.textContent = item.title;

        const time = document.createElement("p");
        time.textContent =
            (dayLabel ? dayLabel + " · " : "") +
            formatTime(item.start) + " – " +
            formatTime(item.end);

        const badge = document.createElement("span");
        badge.className = "event-type-label";
        badge.textContent = typeLabel(item.type);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "event-delete";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Delete " + item.title);

        remove.addEventListener("click", function () {
            schedule = schedule.filter(event => event.id !== item.id);

            saveSchedule();
            renderSchedule();

            message("scheduleMessage", "Schedule deleted.");
        });

        details.append(title, time, badge);
        card.append(details, remove);

        return card;
    }

    function renderSchedule() {
        if (weekDays) {
            weekDays.querySelectorAll("[data-day]").forEach(button => {
                const active = button.dataset.day === activeDay;

                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
            });
        }

        if (dailyAgenda) {
            dailyAgenda.replaceChildren();

            if ($("selectedDay")) {
                $("selectedDay").textContent = activeDay + "'s schedule";
            }

            const events = schedule
                .filter(item => item.day === activeDay)
                .sort((a, b) => a.start.localeCompare(b.start));

            if (events.length === 0) {
                const empty = document.createElement("p");

                empty.className = "empty-schedule";
                empty.textContent =
                    "Your day is waiting to be planned. 🌱";

                dailyAgenda.appendChild(empty);
            } else {
                events.forEach(item => {
                    dailyAgenda.appendChild(createScheduleCard(item));
                });
            }
        }

        if (upcomingEvents) {
            upcomingEvents.replaceChildren();

            const now = new Date();
            const todayIndex = (now.getDay() + 6) % 7;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();

            const events = schedule.map(item => {
                let daysAway =
                    (DAYS.indexOf(item.day) - todayIndex + 7) % 7;

                const [hours, minutes] = item.start.split(":").map(Number);

                if (
                    daysAway === 0 &&
                    hours * 60 + minutes <= nowMinutes
                ) {
                    daysAway = 7;
                }

                return { ...item, daysAway };
            })
            .filter(item => item.daysAway < 7)
            .sort((a, b) =>
                a.daysAway - b.daysAway ||
                a.start.localeCompare(b.start)
            )
            .slice(0, 5);

            if (events.length === 0) {
                const empty = document.createElement("p");

                empty.className = "empty-schedule";
                empty.textContent =
                    "No upcoming events this week. 🌷";

                upcomingEvents.appendChild(empty);
            } else {
                events.forEach(item => {
                    let label = item.day;

                    if (item.daysAway === 0) label = "Today";
                    if (item.daysAway === 1) label = "Tomorrow";

                    upcomingEvents.appendChild(
                        createScheduleCard(item, label)
                    );
                });
            }
        }
    }

    if (weekDays) {
        weekDays.addEventListener("click", function (event) {
            const button = event.target.closest("[data-day]");

            if (!button) return;
            if (!DAYS.includes(button.dataset.day)) return;

            activeDay = button.dataset.day;

            if (eventDay) eventDay.value = activeDay;

            renderSchedule();
        });
    }

    if (scheduleForm) {
        scheduleForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const title = eventTitle.value.trim();
            const day = eventDay.value;
            const start = eventStart.value;
            const end = eventEnd.value;
            const type = eventType.value;

            if (!title || !day || !start || !end) {
                message(
                    "scheduleMessage",
                    "Please fill in all required fields."
                );
                return;
            }

            if (start >= end) {
                message(
                    "scheduleMessage",
                    "End time must be later than start time."
                );
                return;
            }

            const newEvent = {
                id: makeId(),
                title,
                day,
                start,
                end,
                type
            };

            schedule.push(newEvent);

            if (!saveSchedule()) {
                schedule.pop();

                message(
                    "scheduleMessage",
                    "Could not save your schedule."
                );
                return;
            }

            activeDay = day;

            renderSchedule();

            scheduleForm.reset();

            if (eventDay) {
                eventDay.value = activeDay;
            }

            message(
                "scheduleMessage",
                "Added to your schedule! ✨"
            );
        });
    }

    /* =====================================
       SUBJECT MANAGER
    ===================================== */

    let subjects = load(KEYS.subjects, ["General"]);

    if (!Array.isArray(subjects)) subjects = ["General"];

    if (!subjects.includes("General")) {
        subjects.unshift("General");
    }

    function renderSubjects() {
        const select = $("taskSubject");
        const list = $("subjectList");

        if (select) {
            const selected = select.value || "General";

            select.replaceChildren();

            subjects.forEach(subject => {
                const option = document.createElement("option");

                option.value = subject;
                option.textContent = subject;

                select.appendChild(option);
            });

            select.value = subjects.includes(selected)
                ? selected
                : "General";
        }

        if (list) {
            list.replaceChildren();

            subjects.forEach(subject => {
                const chip = document.createElement("span");

                chip.className = "subject-chip";

                const label = document.createElement("span");
                label.textContent = subject;

                chip.appendChild(label);

                if (subject !== "General") {
                    const remove = document.createElement("button");

                    remove.type = "button";
                    remove.textContent = "×";

                    remove.addEventListener("click", function () {
                        subjects = subjects.filter(
                            item => item !== subject
                        );

                        tasks.forEach(task => {
                            if (task.subject === subject) {
                                task.subject = "General";
                            }
                        });

                        save(KEYS.subjects, subjects);
                        saveTasks();

                        renderSubjects();
                        renderTasks();
                    });

                    chip.appendChild(remove);
                }

                list.appendChild(chip);
            });
        }
    }

    const subjectForm = $("subjectForm");

    if (subjectForm) {
        subjectForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const input = $("subjectName");
            const value = input ? input.value.trim() : "";

            if (!value) return;

            if (subjects.some(
                subject => subject.toLowerCase() === value.toLowerCase()
            )) {
                message("subjectMessage", "Subject already exists.");
                return;
            }

            subjects.push(value);

            save(KEYS.subjects, subjects);

            input.value = "";

            renderSubjects();

            message("subjectMessage", "Subject added! ✨");
        });
    }

    /* =====================================
       DAILY GOALS
    ===================================== */

    const goalDate = localDateKey();

    let goals = load(KEYS.goals, {
        date: goalDate,
        tasks: 3,
        minutes: 50
    });

    if (!goals || goals.date !== goalDate) {
        goals = {
            date: goalDate,
            tasks: 3,
            minutes: 50
        };
    }

    if ($("goalTasks")) $("goalTasks").value = goals.tasks;
    if ($("goalMinutes")) $("goalMinutes").value = goals.minutes;

    function updateGoalsDisplay() {
        const taskGoal = Math.max(1, Number(goals.tasks) || 3);
        const minuteGoal = Math.max(5, Number(goals.minutes) || 50);

        const completed = tasks.filter(task => task.completed).length;
        const minutes = Number(focusStats.focusMinutes) || 0;

        if ($("goalTasksProgress")) {
            $("goalTasksProgress").textContent =
                Math.min(completed, taskGoal) + " / " + taskGoal;
        }

        if ($("goalMinutesProgress")) {
            $("goalMinutesProgress").textContent =
                Math.min(minutes, minuteGoal) + " / " +
                minuteGoal + " min";
        }

        if ($("goalTasksFill")) {
            $("goalTasksFill").style.width =
                Math.min(100, completed / taskGoal * 100) + "%";
        }

        if ($("goalMinutesFill")) {
            $("goalMinutesFill").style.width =
                Math.min(100, minutes / minuteGoal * 100) + "%";
        }

        message(
            "goalsMessage",
            completed >= taskGoal && minutes >= minuteGoal
                ? "You reached both goals today! 🌷"
                : "Every small step brings you closer. ♡"
        );
    }

    if ($("goalsForm")) {
        $("goalsForm").addEventListener("submit", function (event) {
            event.preventDefault();

            goals = {
                date: goalDate,
                tasks: Math.max(1, Number($("goalTasks").value) || 3),
                minutes: Math.max(5, Number($("goalMinutes").value) || 50)
            };

            save(KEYS.goals, goals);
            updateGoalsDisplay();

            message("goalsMessage", "Your goals have been saved! 🌱");
        });
    }

    /* =====================================
       DAILY STUDY STREAK
    ===================================== */

    let streak = load(KEYS.streak, {
        lastDate: "",
        count: 0
    });

    function recordStudyActivity() {
        const todayKey = localDateKey();

        if (streak.lastDate === todayKey) {
            renderStreak();
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        streak.count =
            streak.lastDate === localDateKey(yesterday)
                ? (Number(streak.count) || 0) + 1
                : 1;

        streak.lastDate = todayKey;

        save(KEYS.streak, streak);

        renderStreak();
    }

    function renderStreak() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const valid =
            streak.lastDate === localDateKey() ||
            streak.lastDate === localDateKey(yesterday);

        const count = valid ? Number(streak.count) || 0 : 0;

        if ($("streakCount")) {
            $("streakCount").textContent = count;
        }

        message(
            "streakMessage",
            count > 0
                ? "Lovely work showing up for yourself. 🌱"
                : "Complete a task or focus session to start your streak."
        );
    }

    /* =====================================
       OPTIONAL DARK MODE
    ===================================== */

    const themeToggle = $("themeToggle");

    function applyTheme(dark) {
        document.body.classList.toggle("dark-mode", dark);

        if (themeToggle) {
            themeToggle.textContent =
                dark ? "☀️ Light mode" : "🌙 Dark mode";
        }

        save(KEYS.theme, dark ? "dark" : "light");
    }

    applyTheme(load(KEYS.theme, "light") === "dark");

    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            applyTheme(
                !document.body.classList.contains("dark-mode")
            );
        });
    }

    /* =====================================
       STUDY AMBIENCE
    ===================================== */

    const soundToggle = $("soundToggle");
    const soundType = $("soundType");
    const soundVolume = $("soundVolume");

    let audioContext = null;
    let noiseSource = null;
    let noiseGain = null;
    let soundPlaying = false;

    function stopSound() {
        soundPlaying = false;

        if (noiseSource) {
            try {
                noiseSource.stop();
            } catch (error) {}

            noiseSource.disconnect();
            noiseSource = null;
        }

        if (noiseGain) {
            noiseGain.disconnect();
            noiseGain = null;
        }

        if (soundToggle) {
            soundToggle.textContent = "▶ Play ambience";
        }
    }

    async function startSound() {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            message("soundMessage", "Audio isn't supported by this browser.");
            return;
        }

        stopSound();

        audioContext = audioContext || new AudioContextClass();

        await audioContext.resume();

        const bufferSize = audioContext.sampleRate * 2;
        const buffer = audioContext.createBuffer(
            1,
            bufferSize,
            audioContext.sampleRate
        );

        const data = buffer.getChannelData(0);
        const kind = soundType ? soundType.value : "rain";

        let last = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;

            if (kind === "brown") {
                last = (last + 0.02 * white) / 1.02;
                data[i] = last * 3.5;
            } else if (kind === "pink") {
                last = 0.97 * last + 0.03 * white;
                data[i] = last * 2.2;
            } else {
                data[i] = white * 0.3;
            }
        }

        noiseSource = audioContext.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;

        noiseGain = audioContext.createGain();

        noiseGain.gain.value =
            (Number(soundVolume ? soundVolume.value : 10) / 100) * 0.25;

        noiseSource.connect(noiseGain);
        noiseGain.connect(audioContext.destination);

        noiseSource.start();

        soundPlaying = true;

        if (soundToggle) {
            soundToggle.textContent = "Ⅱ Stop ambience";
        }

        message("soundMessage", "Your study ambience is playing. 🌧️");
    }

    if (soundToggle) {
        soundToggle.addEventListener("click", function () {
            if (soundPlaying) {
                stopSound();
            } else {
                startSound().catch(error => {
                    console.error("Audio error:", error);
                    message("soundMessage", "Couldn't start the audio.");
                });
            }
        });
    }

    if (soundType) {
        soundType.addEventListener("change", function () {
            if (soundPlaying) startSound();
        });
    }

    if (soundVolume) {
        soundVolume.addEventListener("input", function () {
            if (noiseGain) {
                noiseGain.gain.value =
                    Number(soundVolume.value) / 100 * 0.25;
            }
        });
    }

    window.addEventListener("beforeunload", stopSound);

    /* =====================================
       BROWSER REMINDERS
    ===================================== */

    let remindersEnabled = false;
    const reminded = new Set();

    if ($("reminderToggle")) {
        $("reminderToggle").addEventListener("click", async function () {
            if (!("Notification" in window)) {
                message(
                    "reminderMessage",
                    "Notifications aren't supported by this browser."
                );
                return;
            }

            if (Notification.permission === "denied") {
                message(
                    "reminderMessage",
                    "Notifications are blocked in browser settings."
                );
                return;
            }

            if (Notification.permission !== "granted") {
                const permission = await Notification.requestPermission();

                if (permission !== "granted") {
                    message(
                        "reminderMessage",
                        "Notification permission wasn't granted."
                    );
                    return;
                }
            }

            remindersEnabled = !remindersEnabled;

            $("reminderToggle").textContent =
                remindersEnabled
                    ? "🔕 Turn reminders off"
                    : "🔔 Enable browser reminders";

            message(
                "reminderMessage",
                remindersEnabled
                    ? "Browser reminders are enabled. 🌷"
                    : "Browser reminders are paused."
            );
        });
    }

    setInterval(function () {
        if (!remindersEnabled) return;

        const now = new Date();
        const todayName = DAYS[(now.getDay() + 6) % 7];

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        schedule.forEach(item => {
            if (item.day !== todayName) return;

            const [hours, minutes] = item.start.split(":").map(Number);
            const startMinutes = hours * 60 + minutes;

            const reminderKey = localDateKey() + "-" + item.id;

            if (
                startMinutes >= currentMinutes &&
                startMinutes <= currentMinutes + 1 &&
                !reminded.has(reminderKey)
            ) {
                reminded.add(reminderKey);

                new Notification("StudyFlow reminder 🌱", {
                    body: item.title + " starts at " +
                        formatTime(item.start) + "."
                });
            }
        });
    }, 30000);

    /* =====================================
       INITIALIZE EVERYTHING
    ===================================== */

    if (eventDay) {
        eventDay.value = activeDay;
    }

    renderTasks();
    updateTaskStats();
    renderPomodoro();
    renderSchedule();
    renderSubjects();
    updateGoalsDisplay();
    renderStreak();
    saveTasks();

    console.log("StudyFlow loaded successfully! 💜");
});