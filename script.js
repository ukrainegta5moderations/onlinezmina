// ================= НАЛАШТУВАННЯ SUPABASE =================
const SUPABASE_URL = "https://mntxteqzxwcbquqbnjax.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rcVqAcRtU8CrZOyuhO6sdA_xySK7sdp"; // <-- Встав ключ сюди!
const ADMIN_PASSWORD = "Mnblkjpoi098+"; // Пароль для адмінки (поки що залишаємо для Кроку 2)

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// =========================================================

let currentMod = null;
let isOnShift = false;
let shiftStartTimeRaw = null;

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
});

// Перевірка сесії (Замість localStorage використовуємо Supabase Session)
async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();
    
    if (session) {
        loadUserDashboard(session.user.email);
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('main-dashboard').style.display = 'none';
    }
}

// Новий вхід через Email + Пароль (Supabase Auth)
async function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        return alert("Будь ласка, введіть Email та пароль!");
    }

    const { data, error } = await db.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        return alert("Помилка входу: Невірний Email або пароль!");
    }

    loadUserDashboard(data.user.email);
}

// Вихід з системи (Supabase Auth)
async function logout() {
    const { error } = await db.auth.signOut();
    if (!error) {
        location.reload();
    } else {
        alert("Сталася помилка при виході!");
    }
}

// Завантаження панелі тепер відбувається за Email
async function loadUserDashboard(email) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'block';

    const { data, error } = await db.from('moderators').select('*').eq('email', email).single();
    
    if (error || !data) {
        alert("Профіль не знайдено в базі модераторів! Зверніться до адміністратора.");
        return;
    }
    
    currentMod = data;
    renderDashboardUI();
    loadUserShiftsHistory();
}

function renderDashboardUI() {
    document.getElementById("user-name").innerText = currentMod.name;
    document.getElementById("user-role").innerText = `${currentMod.role || 'Модератор'} • ${currentMod.email || 'Немає пошти'}`;
    document.querySelector(".avatar").src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentMod.name)}&background=0D8ABC&color=fff&bold=true`;

    document.getElementById("stat-reprimands").innerText = currentMod.reprimands || '0/3';
    document.getElementById("stat-warnings").innerText = currentMod.warnings || '0/2';
    document.getElementById("stat-punishments").innerText = currentMod.punishments || '0';
    document.getElementById("stat-money-warnings").innerText = currentMod.money_warnings || '0';
    document.getElementById("stat-support-replies").innerText = currentMod.support_replies || '0';
    document.getElementById("stat-bonuses").innerText = currentMod.bonuses || '0%';
    document.getElementById("stat-fines").innerText = currentMod.fines || '0%';
    document.getElementById("stat-inactive-days").innerText = currentMod.inactive_days || '0 Days';
    document.getElementById("stat-weekly-online").innerText = currentMod.weekly_online || '0 год.';

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

        await loadUserDashboard(currentMod.email);
    }
    closeModal('shift-modal');
}

// ================= ФУНКЦІЇ АДМІНІСТРАТОРА =================
function openAdminPanel() {
    const pass = prompt("Введіть пароль Старшого Адміністратора:");
    if (pass === ADMIN_PASSWORD) {
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
                    <td><button onclick="openEditStatModal('${mod.email}')" style="background:#3b82f6; border:none; color:white; padding:4px 8px; border-radius:4px; cursor:pointer;">Редагувати</button></td>
                </tr>`;
        });
    }
}

async function addNewModerator() {
    const name = document.getElementById('new-mod-name').value.trim();
    const email = document.getElementById('new-mod-email').value.trim();
    if (!name || !email) return alert("Введіть ім'я та Email!");

    await db.from('moderators').insert([{ name, email }]);
    document.getElementById('new-mod-name').value = "";
    document.getElementById('new-mod-email').value = "";
    
    await loadAdminModsList();
}

async function openEditStatModal(email) {
    const { data, error } = await db.from('moderators').select('*').eq('email', email).single();
    if (!error && data) {
        document.getElementById('edit-mod-title').innerText = `Редагування: ${data.name}`;
        document.getElementById('edit-mod-email-hidden').value = data.email;
        
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
    const email = document.getElementById('edit-mod-email-hidden').value;
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

    await db.from('moderators').update(updates).eq('email', email);
    closeModal('edit-stat-modal');
    await loadAdminModsList();
    if (currentMod && currentMod.email === email) await loadUserDashboard(email); 
}
