// ================= НАЛАШТУВАННЯ ДАНИХ ПРОФІЛЮ (ДИНАМІЧНО З БРАУЗЕРА) =================
let MODERATOR_NAME = localStorage.getItem('ug_mod_name') || "Новий Модератор";
let MODERATOR_EMAIL = localStorage.getItem('ug_mod_email') || "email@не_вказано";
let MODERATOR_ROLE = localStorage.getItem('ug_mod_role') || "Модератор Discord";

let isOnShift = false; 
let shiftStartTimeRaw = null; 

// Завантажуємо історію змін з пам'яті браузера (LocalStorage)
let shiftsHistory = JSON.parse(localStorage.getItem('ug_shifts_history')) || [];

// Ініціалізація після завантаження сторінки
document.addEventListener("DOMContentLoaded", () => {
    // Відновлюємо стан активної зміни, якщо користувач оновив сторінку
    const savedShiftState = localStorage.getItem('ug_current_shift');
    if (savedShiftState) {
        isOnShift = true;
        shiftStartTimeRaw = savedShiftState;
        updateShiftUI(true);
    }

    renderHistoryTable();
    renderProfile();
});

// Збереження виконаної зміни локально
function saveShiftToLocalStorage(date, start, end, duration) {
    const newShift = {
        id: Date.now(),
        date: date,
        start: start,
        end: end,
        duration: duration
    };
    
    shiftsHistory.unshift(newShift); // Додаємо на початок списку
    localStorage.setItem('ug_shifts_history', JSON.stringify(shiftsHistory));
    
    renderHistoryTable();
    renderProfile();
}

// Заповнення таблиці історії
function renderHistoryTable() {
    let tableBody = document.getElementById("history-table-body");
    if (tableBody) {
        tableBody.innerHTML = ""; 

        if (shiftsHistory.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #64748b;">Історія змін порожня</td></tr>`;
            return;
        }

        shiftsHistory.forEach(shift => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${shift.date}</td>
                <td>${shift.start}</td>
                <td>${shift.end}</td>
                <td><span class="status-badge active">${shift.duration}</span></td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// Оновлення полів профілю та картки кількості змін
function renderProfile() {
    const nameEl = document.getElementById("user-name");
    const roleEl = document.getElementById("user-role");
    const avatarEl = document.querySelector(".avatar");
    const shiftCountEl = document.getElementById("stat-shifts");
    
    if (nameEl) nameEl.innerText = MODERATOR_NAME;
    if (roleEl) roleEl.innerText = `${MODERATOR_ROLE} • ${MODERATOR_EMAIL}`;
    
    // Автоматична генерація аватара за першими літерами імені
    if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(MODERATOR_NAME)}&background=0D8ABC&color=fff&bold=true`;
    }
    
    // Відображаємо кількість проведених змін у картці статистики
    if (shiftCountEl) shiftCountEl.innerText = `${shiftsHistory.length}`;
}

// ================= КЕРУВАННЯ МОДАЛЬНИМИ ВІКНАМИ =================
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function closeModalOnOverlay(event, id) { if (event.target.id === id) closeModal(id); }

// Відкриття модалки зміни
function openShiftModal() {
    const modalTitle = document.getElementById('shift-modal-title');
    const modalIcon = document.getElementById('shift-modal-icon');
    const timeLabel = document.getElementById('shift-time-label');
    const submitBtn = document.getElementById('shift-submit-btn');
    const timeInput = document.getElementById('shift-custom-time');

    const options = { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false };
    const kyivTimeStr = new Date().toLocaleString('uk-UA', options);
    
    if (timeInput) timeInput.value = kyivTimeStr;

    if (!isOnShift) {
        if (modalTitle) modalTitle.innerText = "Відкриття робочої зміни";
        if (modalIcon) modalIcon.className = "fa-solid fa-play";
        if (timeLabel) timeLabel.innerText = "Час початку зміни (Київ):";
        if (submitBtn) submitBtn.innerText = "Підтвердити старт";
    } else {
        if (modalTitle) modalTitle.innerText = "Завершення робочої зміни";
        if (modalIcon) modalIcon.className = "fa-solid fa-stop";
        if (timeLabel) timeLabel.innerText = "Час закінчення зміни (Київ):";
        if (submitBtn) submitBtn.innerText = "Підтвердити кінець";
    }

    openModal('shift-modal');
}

// Відкриття налаштувань профілю
function openSettingsModal() {
    document.getElementById('input-username').value = MODERATOR_NAME !== "Новий Модератор" ? MODERATOR_NAME : "";
    document.getElementById('input-email').value = MODERATOR_EMAIL !== "email@не_вказано" ? MODERATOR_EMAIL : "";
    document.getElementById('input-role').value = MODERATOR_ROLE;
    openModal('settings-modal');
}

// ================= ОБРОБКА ДАТИ ТА ЧАСУ =================
function getFormattedDate() {
    const options = { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date().toLocaleDateString('uk-UA', options);
}

function calculateDuration(startTimeStr, endTimeStr) {
    try {
        const [startH, startM] = startTimeStr.split(':').map(Number);
        const [endH, endM] = endTimeStr.split(':').map(Number);
        
        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;
        
        if (endMinutes < startMinutes) endMinutes += 24 * 60; // Перехід через північ
        
        const diffMinutes = endMinutes - startMinutes;
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        
        return `${hours} год. ${minutes} хв.`;
    } catch (e) {
        return "0 год. 0 хв.";
    }
}

// ================= КЕРУВАННЯ СТАНОМ ЗМІНИ =================
function updateShiftUI(isActive) {
    const shiftBtn = document.getElementById('shift-btn');
    const shiftText = document.getElementById('shift-btn-title');
    const shiftIcon = document.getElementById('shift-icon');
    const statusDot = document.getElementById('status-dot');

    if (isActive) {
        if (shiftText) shiftText.innerText = "Завершити зміну";
        if (shiftIcon) shiftIcon.className = "fa-solid fa-stop";
        if (statusDot) statusDot.classList.add('active'); 
        if (shiftBtn) shiftBtn.classList.add('active');
    } else {
        if (shiftText) shiftText.innerText = "Почати зміну";
        if (shiftIcon) shiftIcon.className = "fa-solid fa-play";
        if (statusDot) statusDot.classList.remove('active'); 
        if (shiftBtn) shiftBtn.classList.remove('active');
    }
}

function confirmShiftAction() {
    const timeInput = document.getElementById('shift-custom-time').value;
    const currentDateStr = getFormattedDate();

    if (!isOnShift) {
        isOnShift = true;
        shiftStartTimeRaw = timeInput; 
        localStorage.setItem('ug_current_shift', timeInput); 
        updateShiftUI(true);
    } else {
        isOnShift = false;
        const durationStr = calculateDuration(shiftStartTimeRaw, timeInput);
        saveShiftToLocalStorage(currentDateStr, shiftStartTimeRaw, timeInput, durationStr);
        localStorage.removeItem('ug_current_shift'); 
        updateShiftUI(false);
    }

    closeModal('shift-modal');
}

// ================= ЗБЕРЕЖЕННЯ НАЛАШТУВАНЬ =================
function saveSettings() {
    const newName = document.getElementById('input-username').value.trim();
    const newEmail = document.getElementById('input-email').value.trim();
    const newRole = document.getElementById('input-role').value.trim();

    if (newName) { MODERATOR_NAME = newName; localStorage.setItem('ug_mod_name', newName); }
    if (newEmail) { MODERATOR_EMAIL = newEmail; localStorage.setItem('ug_mod_email', newEmail); }
    if (newRole) { MODERATOR_ROLE = newRole; localStorage.setItem('ug_mod_role', newRole); }

    renderProfile();
    closeModal('settings-modal');
}
