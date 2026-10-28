import os
import datetime
import jwt
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)


def get_db_connection():
    return mysql.connector.connect(
        host=app.config['DB_HOST'],
        user=app.config['DB_USER'],
        password=app.config['DB_PASSWORD'],
        database=app.config['DB_NAME'],
        port=app.config['DB_PORT']
    )


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({'error': 'Token is missing'}), 401

        try:
            secret_key = str(app.config['SECRET_KEY'])
            data = jwt.decode(token, secret_key, algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(current_user_id, *args, **kwargs)

    return decorated


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)"
        cursor.execute(query, (name, email, hashed_password))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": "Email already registered or database error"}), 400


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({"error": "Invalid credentials"}), 401

        payload = {
            'user_id': user['id'],
            'email': user['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }
        secret_key = str(app.config['SECRET_KEY'])
        token = jwt.encode(payload, secret_key, algorithm='HS256')

        return jsonify({"message": "Login successful", "token": token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/appointments', methods=['GET'])
@token_required
def get_appointments(current_user_id):
    status_filter = request.args.get('status')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if status_filter:
            query = "SELECT * FROM appointments WHERE user_id = %s AND status = %s ORDER BY appointment_date, appointment_time"
            cursor.execute(query, (current_user_id, status_filter))
        else:
            query = "SELECT * FROM appointments WHERE user_id = %s ORDER BY appointment_date, appointment_time"
            cursor.execute(query, (current_user_id,))

        appointments = cursor.fetchall()
        cursor.close()
        conn.close()

        formatted_appointments = []
        for app_item in appointments:
            formatted_app = dict(app_item)
            if formatted_app.get('appointment_date'):
                formatted_app['appointment_date'] = str(formatted_app['appointment_date'])
            if formatted_app.get('appointment_time'):
                formatted_app['appointment_time'] = str(formatted_app['appointment_time'])
            if formatted_app.get('created_at'):
                formatted_app['created_at'] = str(formatted_app['created_at'])
            formatted_appointments.append(formatted_app)

        return jsonify(formatted_appointments), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/appointments/<int:appt_id>', methods=['GET'])
@token_required
def get_appointment_by_id(current_user_id, appt_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM appointments WHERE id = %s AND user_id = %s",
            (appt_id, current_user_id)
        )
        appt = cursor.fetchone()
        cursor.close()
        conn.close()

        if not appt:
            return jsonify({'message': 'Appointment not found!'}), 404

        appt['appointment_date'] = str(appt['appointment_date'])
        appt['appointment_time'] = str(appt['appointment_time'])

        return jsonify(appt), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/appointments', methods=['POST'])
@token_required
def create_appointment(current_user_id):
    data = request.get_json() or {}

    required_fields = ['client_name', 'service_name', 'appointment_date', 'appointment_time']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            INSERT INTO appointments (user_id, client_name, client_email, client_phone, service_name, appointment_date, appointment_time, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            current_user_id,
            data['client_name'].strip(),
            data.get('client_email', '').strip(),
            data.get('client_phone', '').strip(),
            data['service_name'].strip(),
            data['appointment_date'],
            data['appointment_time'],
            data.get('notes', '').strip()
        )

        cursor.execute(query, values)
        conn.commit()
        new_id = cursor.lastrowid

        cursor.close()
        conn.close()

        return jsonify({"message": "Appointment created successfully", "id": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/appointments/<int:appt_id>', methods=['PUT'])
@token_required
def update_appointment(current_user_id, appt_id):
    data = request.get_json() or {}

    client_name = data.get('client_name', '').strip()
    service_name = data.get('service_name', '').strip()
    appointment_date = data.get('appointment_date')
    appointment_time = data.get('appointment_time')

    if not client_name or not service_name or not appointment_date or not appointment_time:
        return jsonify({'message': 'Please fill in all required fields!'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            UPDATE appointments
            SET client_name = %s, client_email = %s, client_phone = %s, service_name = %s, appointment_date = %s, appointment_time = %s, notes = %s
            WHERE id = %s AND user_id = %s
        """
        values = (
            client_name,
            data.get('client_email', '').strip(),
            data.get('client_phone', '').strip(),
            service_name,
            appointment_date,
            appointment_time,
            data.get('notes', '').strip(),
            appt_id,
            current_user_id
        )

        cursor.execute(query, values)
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': 'Appointment updated successfully!'}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/appointments/<int:appointment_id>/status', methods=['PATCH'])
@token_required
def update_appointment_status(current_user_id, appointment_id):
    data = request.get_json() or {}
    new_status = data.get('status')

    if new_status not in ['Scheduled', 'Completed', 'Canceled']:
        return jsonify({"error": "Invalid status value"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = "UPDATE appointments SET status = %s WHERE id = %s AND user_id = %s"
        cursor.execute(query, (new_status, appointment_id, current_user_id))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "Status updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=app.config.get('PORT', 5000), debug=True)