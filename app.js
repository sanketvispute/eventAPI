require('dotenv').config()
const express = require('express')
const cors = require('cors') // CORS middleware
const { body, validationResult } = require('express-validator')
const rateLimit = require('express-rate-limit');
const helmet = require('helmet') // Helmet for secure HTTP headers
const morgan = require('morgan') // Morgan for logging
const axios = require('axios')
const app = express()
const mongoose = require('mongoose')
const { Schema } = mongoose



main().catch(err => console.log(err))

async function main() {
    await mongoose.connect(process.env.MONGO_URL)
}


const eventSchema = new Schema({
    name: { type: String },
    email: { type: String },
    contact: { type: String },
    meal: { type: String }
})

const events = mongoose.model('event', eventSchema)

// const corsOptions = {
//     origin: 'http://localhost:5173', // Replace with your frontend URL
//     methods: ['GET', 'POST'], // Allowed HTTP methods
//     allowedHeaders: ['Content-Type'], // Allowed headers
// };

app.use(morgan('combined'))
app.use(helmet()); // Add Helmet for secure HTTP headers
app.use(express.json())
app.use(cors())


const rsvpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: "Too many submissions, please try again later.",
});
app.get('/', async (req, res) => {
    try {
        const result = await events.find({})
        res.send(result)
    }
    catch (err) {
        res.send(err)
    }

})


app.post('/',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('contact').isMobilePhone().withMessage('Invalid contact number'),
        body('meal').notEmpty().withMessage('Meal is required'),
    ],
    rsvpLimiter,
    async (req, res) => {

        try {
            const { name, email, contact, meal, captchaResponse } = req.body; // Use "captchaResponse" here

            if (!captchaResponse) {
                return res.status(400).json({ message: "reCAPTCHA token is missing" });
            }
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const response = await axios.post(
                "https://www.google.com/recaptcha/api/siteverify",
                null,
                {
                    params: {
                        secret: process.env.RECAPTCHA_SECRET_KEY,
                        response: captchaResponse, // Use "captchaResponse" here
                    },
                }
            );

            const { success, "error-codes": errorCodes } = response.data;

            if (!success) {
                console.error("reCAPTCHA verification failed:", errorCodes);
                return res.status(400).json({ message: "Failed reCAPTCHA verification" });
            }
            // console.log("body", req.body)
            const doc = new events(req.body)
            const result = await doc.save()
            res.send(result)
        } catch (err) {
            res.send(err)
        }
    })

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`EventsAPI Server started on ${PORT}`)
})