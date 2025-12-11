# Smart Medication Reminder
A **web-based Smart Medication Reminder system** built using **Spring Boot** and **Spring Data JPA** with an **H2 in-memory database**.  
It helps users manage medicines, receive timely reminders, and track adherence through a simple dashboard.
## Features
- Add medicines with name, dosage, start date, and end date.
- Set multiple reminder times per medicine.
- Pre-reminders (10 minutes before scheduled time) and exact-time notifications.
- Track medicine adherence via a dashboard.
- User-friendly web interface.
## Technology Stack
- Backend: Spring Boot (Java)  
- Database: H2 (Spring Data JPA)  
- Frontend: HTML, CSS, JSP, JavaScript  
- Build Tool: Maven  
## Installation & Setup
1. **Clone the repository**
   git clone https://github.com/shivanichauhan666/smart-medication-reminder.git
   cd smart-medication-reminder
2. **Run the project**
   mvn clean install
   mvn spring-boot:run
3. **Open in browser**
   http://localhost:8080
4. **H2 Database Console**
   http://localhost:8080/h2-console
   JDBC URL: jdbc:h2:mem:testdb (default)
   Username: sa
   Password: leave blank
## Usage
Add medicines and set schedules.
Receive notifications 10 minutes before and at the scheduled time.
Mark medicines as taken.
View adherence through the dashboard.
## License
This project is licensed under the MIT License.

