const API_URL = 'http://127.0.0.1:5000/api/appointments';
let cachedAppointments = [];

function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
    }
    return token;
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initSettings();

    document.getElementById('theme-toggle').addEventListener('change', toggleTheme);
    document.getElementById('open-settings-btn').addEventListener('click', openSettings);
    document.getElementById('close-settings-btn').addEventListener('click', closeSettings);
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

    document.getElementById('no_email_checkbox').addEventListener('change', handleNoEmailToggle);
    document.getElementById('no_phone_checkbox').addEventListener('change', handleNoPhoneToggle);

    fetchAppointments();

    document.getElementById('appointment-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

    document.getElementById('status-filter').addEventListener('change', (e) => {
        fetchAppointments(e.target.value);
    });
});

function handleNoEmailToggle(e) {
    const emailInput = document.getElementById('client_email');
    if (e.target.checked) {
        emailInput.value = '';
        emailInput.required = false;
        emailInput.disabled = true;
        emailInput.placeholder = 'N/A';
    } else {
        emailInput.disabled = false;
        emailInput.required = true;
        emailInput.placeholder = 'john@example.com';
    }
}

function handleNoPhoneToggle(e) {
    const phoneInput = document.getElementById('client_phone');
    if (e.target.checked) {
        phoneInput.value = '';
        phoneInput.required = false;
        phoneInput.disabled = true;
        phoneInput.placeholder = 'N/A';
    } else {
        phoneInput.disabled = false;
        phoneInput.required = true;
        phoneInput.placeholder = '+1 00 00000 0000';
    }
}

function getDateFormat() {
    return localStorage.getItem('dateFormat') || 'YYYY-MM-DD';
}

function getTimeFormat() {
    return localStorage.getItem('timeFormat') || '24';
}

function initSettings() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const themeToggle = document.getElementById('theme-toggle');

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.checked = false;
    }

    document.getElementById('setting-date-format').value = getDateFormat();
    document.getElementById('setting-time-format').value = getTimeFormat();
}

function toggleTheme(e) {
    const isDarkMode = e.target.checked;
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}

function openSettings() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

function saveSettings() {
    const dateFormat = document.getElementById('setting-date-format').value;
    const timeFormat = document.getElementById('setting-time-format').value;

    localStorage.setItem('dateFormat', dateFormat);
    localStorage.setItem('timeFormat', timeFormat);

    closeSettings();
    renderTable(cachedAppointments);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const [year, month, day] = parts;
    const format = getDateFormat();

    if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
    if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
    return `${year}-${month}-${day}`;
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;

    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const format = getTimeFormat();

    if (format === '12') {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const strHours = hours < 10 ? '0' + hours : hours;
        return `${strHours}:${minutes} ${ampm}`;
    }

    const strHours = hours < 10 ? '0' + hours : hours;
    return `${strHours}:${minutes}`;
}

async function fetchAppointments(status = '') {
    const token = checkAuth();

    try {
        let url = API_URL;
        if (status) {
            url += `?status=${status}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const data = await response.json();
        cachedAppointments = data;
        renderTable(data);
    } catch (error) {
        console.error('Error fetching appointments:', error);
    }
}

function renderTable(appointments) {
    const tbody = document.getElementById('appointments-tbody');
    tbody.innerHTML = '';

    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No appointments found.</td></tr>';
        return;
    }

    appointments.forEach(app => {
        const row = document.createElement('tr');

        const displayDate = formatDate(app.appointment_date);
        const displayTime = formatTime(app.appointment_time);
        const emailDisplay = app.client_email || 'N/A';
        const phoneDisplay = app.client_phone || 'N/A';
        const notesHtml = app.notes ? `<br><small style="color: var(--text-muted);">${app.notes}</small>` : '';

        row.innerHTML = `
            <td><strong>${app.client_name}</strong></td>
            <td>${app.service_name}${notesHtml}</td>
            <td>${displayDate} at ${displayTime}</td>
            <td>${emailDisplay}<br><small>${phoneDisplay}</small></td>
            <td><span class="badge badge-${app.status.toLowerCase()}">${app.status}</span></td>
            <td>
                <button class="btn btn-sm" onclick="editAppointment(${app.id})">Edit</button>
                ${app.status === 'Scheduled' ? `
                    <button class="btn btn-sm" onclick="updateStatus(${app.id}, 'Completed')">Done</button>
                    <button class="btn btn-sm" onclick="updateStatus(${app.id}, 'Canceled')">Cancel</button>
                ` : ''}
            </td>
        `;

        tbody.appendChild(row);
    });
}

function editAppointment(id) {
    const app = cachedAppointments.find(a => a.id === id);
    if (!app) return;

    document.getElementById('editing_id').value = app.id;
    document.getElementById('client_name').value = app.client_name;

    const noEmailCheckbox = document.getElementById('no_email_checkbox');
    const emailInput = document.getElementById('client_email');

    if (!app.client_email || app.client_email === 'N/A') {
        noEmailCheckbox.checked = true;
        handleNoEmailToggle({ target: noEmailCheckbox });
    } else {
        noEmailCheckbox.checked = false;
        handleNoEmailToggle({ target: noEmailCheckbox });
        emailInput.value = app.client_email;
    }

    const noPhoneCheckbox = document.getElementById('no_phone_checkbox');
    const phoneInput = document.getElementById('client_phone');

    if (!app.client_phone || app.client_phone === 'N/A') {
        noPhoneCheckbox.checked = true;
        handleNoPhoneToggle({ target: noPhoneCheckbox });
    } else {
        noPhoneCheckbox.checked = false;
        handleNoPhoneToggle({ target: noPhoneCheckbox });
        phoneInput.value = app.client_phone;
    }

    document.getElementById('service_name').value = app.service_name;
    document.getElementById('appointment_date').value = app.appointment_date;
    document.getElementById('appointment_time').value = app.appointment_time;
    document.getElementById('notes').value = app.notes || '';

    document.getElementById('form-title').textContent = 'Edit Appointment';
    document.getElementById('submit-btn').textContent = 'Update Appointment';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('editing_id').value = '';
    document.getElementById('appointment-form').reset();

    const noEmailCheckbox = document.getElementById('no_email_checkbox');
    noEmailCheckbox.checked = false;
    handleNoEmailToggle({ target: noEmailCheckbox });

    const noPhoneCheckbox = document.getElementById('no_phone_checkbox');
    noPhoneCheckbox.checked = false;
    handleNoPhoneToggle({ target: noPhoneCheckbox });

    document.getElementById('form-title').textContent = 'Book New Appointment';
    document.getElementById('submit-btn').textContent = 'Schedule Appointment';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const token = checkAuth();

    const editingId = document.getElementById('editing_id').value;
    const noEmail = document.getElementById('no_email_checkbox').checked;
    const noPhone = document.getElementById('no_phone_checkbox').checked;

    const appointmentData = {
        client_name: document.getElementById('client_name').value,
        client_email: noEmail ? 'N/A' : document.getElementById('client_email').value,
        client_phone: noPhone ? 'N/A' : document.getElementById('client_phone').value,
        service_name: document.getElementById('service_name').value,
        appointment_date: document.getElementById('appointment_date').value,
        appointment_time: document.getElementById('appointment_time').value,
        notes: document.getElementById('notes').value
    };

    const isEdit = Boolean(editingId);
    const url = isEdit ? `${API_URL}/${editingId}` : API_URL;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(appointmentData)
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (response.ok) {
            resetForm();
            fetchAppointments();
        } else {
            const err = await response.json();
            alert('Error: ' + err.error);
        }
    } catch (error) {
        console.error('Error saving appointment:', error);
    }
}

async function updateStatus(id, newStatus) {
    const token = checkAuth();

    try {
        const response = await fetch(`${API_URL}/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.status === 401) {
            logout();
            return;
        }

        if (response.ok) {
            fetchAppointments();
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}