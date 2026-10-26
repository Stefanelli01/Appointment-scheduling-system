const API_URL = 'http://127.0.0.1:5000/api/appointments';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    document.getElementById('theme-toggle').addEventListener('change', toggleTheme);

    fetchAppointments();

    document.getElementById('appointment-form').addEventListener('submit', handleCreateAppointment);

    document.getElementById('status-filter').addEventListener('change', (e) => {
        fetchAppointments(e.target.value);
    });
});



function initTheme() {

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const themeToggle = document.getElementById('theme-toggle');

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    }
    else {
        document.body.classList.remove('dark-mode');
        themeToggle.checked = false;
    }
}



function toggleTheme(e) {

    const isDarkMode = e.target.checked;

    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    }
    else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}



async function fetchAppointments(status = '') {

    try {
        let url = API_URL;
        if (status) {
            url += `?status=${status}`;
        }

        const response = await fetch(url);
        const data = await response.json();

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

        row.innerHTML = `
            <td><strong>${app.client_name}</strong></td>
            <td>${app.service_name}</td>
            <td>${app.appointment_date} at ${app.appointment_time}</td>
            <td>${app.client_email}<br><small>${app.client_phone}</small></td>
            <td><span class="badge badge-${app.status}">${app.status}</span></td>
            <td>
                ${app.status === 'Scheduled' ? `
                    <button class="btn btn-sm" onclick="updateStatus(${app.id}, 'Completed')">Done</button>
                    <button class="btn btn-sm" onclick="updateStatus(${app.id}, 'Canceled')">Cancel</button>
                ` : '-'}
            </td>
        `;

        tbody.appendChild(row);
    });
}



async function handleCreateAppointment(e) {

    e.preventDefault();

    const newAppointment = {

        client_name: document.getElementById('client_name').value,
        client_email: document.getElementById('client_email').value,
        client_phone: document.getElementById('client_phone').value,
        service_name: document.getElementById('service_name').value,
        appointment_date: document.getElementById('appointment_date').value,
        appointment_time: document.getElementById('appointment_time').value
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAppointment)
        });

        if (response.ok) {
            document.getElementById('appointment-form').reset();
            fetchAppointments();
        }
        else {
            const err = await response.json();
            alert('Error: ' + err.error);
        }
    } catch (error) {
        console.error('Error creating appointment:', error);
    }
}

async function updateStatus(id, newStatus) {
    try {
        const response = await fetch(`${API_URL}/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            fetchAppointments();
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}