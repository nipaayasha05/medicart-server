## Medicart

# Admin

- username :admin
- email:admin@gmail.com
- password:ABC123abc@

# Live site URL :https://illustrious-pudding-bb0b01.netlify.app/

# features

- JWT-based authentication using jsonwebtoken
- Middleware for verifyToken, verifyAdmin, verifySeller.
- Routes protected based on roles (admin, seller, user).
- Secure stripe payment API.
- Create payment intents and confirm payments.
- Store payment details and status in database.
- Firebase config and DB credentials secured using .env variables.
- Admin and sellers can fetch sales reports and payment histories.
- MongoDB for all data storage.
- Generate sales reports with filtering options by date.
- Collections: users, categories, medicines, payments, orders, advertisements, cart, sales
