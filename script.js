// ================= НАЛАШТУВАННЯ SUPABASE =================
const SUPABASE_URL = "https://mntxteqzxwcbquqbnjax.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rcVqAcRtU8CrZOyuhO6sdA_xySK7sdp"; // <-- Встав ключ сюди!
const ADMIN_PASSWORD = "1234"; // Пароль для адмінки

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// =========================================================

let currentMod = null;
let isOnShift = false;
let shiftStartTimeRaw = null;

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
});

// Завантаження списку користувачів
function checkAuth() {
    const savedUser = localStorage.getItem('active_ug_user');
    if (savedUser) {
        loadUserDashboard(savedUser);
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-dashboard').style.display = 'none';
    }
}

async function loginUser() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username || !password) {
        return alert("Будь ласка, введіть нікнейм та пароль!");
    }

    // Шукаємо модератора в базі за нікнеймом
    const { data, error } = await db.from('moderators').select('*').eq('name', username).single();

    if (error || !data) {
        return alert("Такого модератора не знайдено! Перевірте правильність вводу або зверніться до Адміністратора.");
    }

    // Якщо пароль ще не встановлено (це перший вхід модератора)
    if (!data.password) {
        const confirmMsg = confirm(`Це ваш перший вхід. Встановити введений пароль як ваш постійний?`);
        if (confirmMsg) {
            // Зберігаємо пароль у базу
            await db.from('moderators').update({ password: password }).eq('name', username);
            alert("Пароль успішно створено! Ви увійшли в систему.");
            
            // Зберігаємо сесію і пускаємо в панель
            localStorage.setItem('active_ug_user', username);
            loadUserDashboard(username);
        }
        return;
    }

    // Якщо пароль вже встановлено раніше, перевіряємо його
    if (data.password !== password) {
        return alert("Невірний пароль!");
    }

    // Якщо пароль правильний — пускаємо в панель
    localStorage.setItem('active_ug_user', username);
    loadUserDashboard(username);
}

function logout() {
    localStorage.removeItem('active_ug_user');
    location.reload();
}

async function loadUserDashboard(name) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'block';

    const { data, error } = await db.from('moderators').select('*').eq('name', name).single();
    if (!error && data) {
        currentMod = data;
        renderDashboardUI();
        loadUserShiftsHistory();
    }
}

function renderDashboardUI() {
    document.getElementById("user-name").innerText = currentMod.name;
    document.getElementById("user-role").innerText = `${currentMod.role} • ${currentMod.email || 'Немає пошти'}`;
    document.querySelector(".avatar").src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentMod.name)}&background=0D8ABC&color=fff&bold=true`;

    document.getElementById("stat-reprimands").innerText = currentMod.reprimands;
    document.getElementById("stat-warnings").innerText = currentMod.warnings;
    document.getElementById("stat-punishments").innerText = currentMod.punishments;
    document.getElementById("stat-money-warnings").innerText = currentMod.money_warnings;
    document.getElementById("stat-support-replies").innerText = currentMod.support_replies;
    document.getElementById("stat-bonuses").innerText = currentMod.bonuses;
    document.getElementById("stat-fines").innerText = currentMod.fines;
    document.getElementById("stat-inactive-days").innerText = currentMod.inactive_days;
    document.getElementById("stat-weekly-online").innerText = currentMod.weekly_online;

    const savedShiftState = localStorage.getItem(`ug_shift_${currentMod.name}`);
    if (savedShiftState) {
        isOnShift = true;
        shiftStartTimeRaw = savedShiftState;
        updateShiftUI(true);
    } else {
        isOnShift = false;
        updateShiftUI(false);
    }
}

async function loadUserShiftsHistory() {
    const { data, error } = await db.from('shifts').select('*').eq('moderator_name', currentMod.name).order('timestamp', { ascending: false });
    const tableBody = document.getElementById("history-table-body");
    
    if (!error && data) {
        document.getElementById("stat-shifts").innerText = data.length;
        tableBody.innerHTML = data.length === 0 ? '<tr><td colspan="4" style="text-align:center;">Історія порожня</td></tr>' : '';
        data.forEach(shift => {
            tableBody.innerHTML += `<tr><td>${shift.date}</td><td>${shift.start_time}</td><td>${shift.end_time}</td><td><span class="status-badge active">${shift.duration}</span></td></tr>`;
        });
    }
}

// КЕРУВАННЯ ВІКНАМИ
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { 
    document.getElementById(id)?.classList.remove('open'); 
    
    // Якщо закриваємо адмін-панель і ми ще не увійшли в акаунт — повертаємо вікно логіну
    if (id === 'admin-modal' && !currentMod) {
        document.getElementById('login-overlay').style.display = 'flex';
    }
}
function closeModalOnOverlay(event, id) { if (event.target.id === id) closeModal(id); }

function openShiftModal() {
    document.getElementById('shift-custom-time').value = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('shift-modal-title').innerText = !isOnShift ? "Відкриття робочої зміни" : "Завершення робочої зміни";
    openModal('shift-modal');
}

function updateShiftUI(isActive) {
    document.getElementById('shift-btn-title').innerText = isActive ? "Завершити зміну" : "Почати зміну";
    document.getElementById('shift-icon').className = isActive ? "fa-solid fa-stop" : "fa-solid fa-play";
    document.getElementById('status-dot').classList.toggle('active', isActive);
    document.getElementById('shift-btn').classList.toggle('active', isActive);
}

async function confirmShiftAction() {
    const timeInput = document.getElementById('shift-custom-time').value;
    const today = new Date().toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric' });

    if (!isOnShift) {
        isOnShift = true;
        shiftStartTimeRaw = timeInput;
        localStorage.setItem(`ug_shift_${currentMod.name}`, timeInput);
        updateShiftUI(true);
    } else {
        isOnShift = false;
        localStorage.removeItem(`ug_shift_${currentMod.name}`);
        updateShiftUI(false);

        const [sH, sM] = shiftStartTimeRaw.split(':').map(Number);
        const [eH, eM] = timeInput.split(':').map(Number);
        let diff = (eH * 60 + eM) - (sH * 60 + sM);
        if (diff < 0) diff += 24 * 60;
        const durationStr = `${Math.floor(diff / 60)} год. ${diff % 60} хв.`;

        await db.from('shifts').insert([{
            moderator_name: currentMod.name, date: today, start_time: shiftStartTimeRaw, end_time: timeInput, duration: durationStr, timestamp: Date.now()
        }]);

        await loadUserDashboard(currentMod.name);
    }
    closeModal('shift-modal');
}

// ================= ФУНКЦІЇ АДМІНІСТРАТОРА =================
function openAdminPanel() {
    const pass = prompt("Введіть пароль Старшого Адміністратора:");
    if (pass === ADMIN_PASSWORD) {
        // Ховаємо панель входу, щоб вона не перекривала адмінку
        document.getElementById('login-overlay').style.display = 'none';
        
        openModal('admin-modal');
        loadAdminModsList();
    } else if (pass !== null) {
        alert("Невірний пароль!");
    }
}
async function loadAdminModsList() {
    const { data, error } = await db.from('moderators').select('*').order('name');
    const container = document.getElementById('admin-mods-list');
    if (!error && data) {
        container.innerHTML = "";
        data.forEach(mod => {
            container.innerHTML += `
                <tr>
                    <td><b>${mod.name}</b></td>
                    <td>${mod.reprimands}</td>
                    <td>${mod.warnings}</td>
                    <td>${mod.punishments}</td>
                    <td>${mod.fines}</td>
                    <td><button onclick="openEditStatModal('${mod.name}')" style="background:#3b82f6; border:none; color:white; padding:4px 8px; border-radius:4px; cursor:pointer;">Редагувати</button></td>
                </tr>`;
        });
    }
}

async function addNewModerator() {
    const name = document.getElementById('new-mod-name').value.trim();
    const email = document.getElementById('new-mod-email').value.trim();
    if (!name) return alert("Введіть хоча б ім'я!");

    await db.from('moderators').insert([{ name, email }]);
    document.getElementById('new-mod-name').value = "";
    document.getElementById('new-mod-email').value = "";
    
    await loadAdminModsList();
}

async function openEditStatModal(name) {
    const { data, error } = await db.from('moderators').select('*').eq('name', name).single();
    if (!error && data) {
        document.getElementById('edit-mod-title').innerText = `Редагування: ${data.name}`;
        document.getElementById('edit-mod-name-hidden').value = data.name;
        
        document.getElementById('edit-reprimands').value = data.reprimands;
        document.getElementById('edit-warnings').value = data.warnings;
        document.getElementById('edit-punishments').value = data.punishments;
        document.getElementById('edit-money-warnings').value = data.money_warnings;
        document.getElementById('edit-support-replies').value = data.support_replies;
        document.getElementById('edit-bonuses').value = data.bonuses;
        document.getElementById('edit-fines').value = data.fines;
        document.getElementById('edit-inactive-days').value = data.inactive_days;
        document.getElementById('edit-weekly-online').value = data.weekly_online;

        openModal('edit-stat-modal');
    }
}

async function submitAdminChanges() {
    const name = document.getElementById('edit-mod-name-hidden').value;
    const updates = {
        reprimands: document.getElementById('edit-reprimands').value,
        warnings: document.getElementById('edit-warnings').value,
        punishments: parseInt(document.getElementById('edit-punishments').value) || 0,
        money_warnings: parseInt(document.getElementById('edit-money-warnings').value) || 0,
        support_replies: parseInt(document.getElementById('edit-support-replies').value) || 0,
        bonuses: document.getElementById('edit-bonuses').value,
        fines: document.getElementById('edit-fines').value,
        inactive_days: document.getElementById('edit-inactive-days').value,
        weekly_online: document.getElementById('edit-weekly-online').value,
    };

    await db.from('moderators').update(updates).eq('name', name);
    closeModal('edit-stat-modal');
    await loadAdminModsList();
    if (currentMod && currentMod.name === name) await loadUserDashboard(name); 
}
