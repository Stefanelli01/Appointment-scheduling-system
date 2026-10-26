import mysql
from flask import Flask, request, jsonify
from flask_cors import CORS
from config import get_db_connection

app = Flask(__name__)

CORS(app)


@app.route('/api/appointments', methods=['GET'])
def get_appointments():

    status_filter = request.args.get('status')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if status_filter:
            query = "SELECT * FROM appointments WHERE status = %s ORDER BY appointment_date, appointment_time"
            cursor.execute(query, (status_filter,))
        else:
            query = "SELECT * FROM appointments ORDER BY appointment_date, appointment_time"
            cursor.execute(query)

        appointments = cursor.fetchall()
        cursor.close()
        conn.close()

        formatted_appointments = []
        for app in appointments:
            formatted_app = dict(app)
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



@app.route('/api/appointments', methods=['POST'])
def create_appointment():

    data = request.get_json()

    required_fields = ['client_name', 'client_email', 'client_phone', 'service_name', 'appointment_date', 'appointment_time']

    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Field {field} is required.'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            INSERT INTO appointments (client_name, client_email, client_phone, service_name, appointment_date, appointment_time)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        values = (
            data['client_name'],
            data['client_email'],
            data['client_phone'],
            data['service_name'],
            data['appointment_date'],
            data['appointment_time']
        )

        cursor.execute(query, values)
        conn.commit()
        new_id = cursor.lastrowid

        cursor.close()
        conn.close()

        return jsonify({"message": "Appointment created successfully", "id": new_id}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/appointments/<int:appointment_id>/status', methods=['PATCH'])
def update_status(appointment_id):

    data = request.get_json()
    new_status = data.get('status')


    if new_status not in ['Scheduled', 'Completed', 'Canceled']:
        return jsonify({"error": "Invalid status value"}), 400


    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = "UPDATE appointments SET status = %s WHERE id = %s"
        cursor.execute(query, (new_status, appointment_id))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"message": "Status updated successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True, port=5000)