const express = require('express')
const app = express()
const mysql = require('mysql2')
const bodyParser = require('body-parser')
const pug = require('pug')
const logger = require('morgan')
const path = require("path")
const nodemailer = require('nodemailer')
const user = process.env.FoodOrderBookEmail
const pass = process.env.FoodOrderBookAppPass
const validator = require('validator');

// All static files routing
app.use(express.static(path.join(__dirname, 'public')))
// create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false })

// Log the requests
app.use(logger('dev'))
// Set View Engine as Pug
app.set('view engine', 'pug')
app.use(urlencodedParser)

function isValidEmail(email) {
    return validator.isEmail(email);
}

// Index
app.get('/', (request, response) => {
    // request.body  // Things sent to you
    // response.send()  // Sends back to the user
    response.render('home', {title: "Lemonade Stand"})  // (Name of the view to render, options in object form {key : value})
})

app.get('/home', (request, response) => {
    response.render('home', {title: "Lemonade Stand"})  // (Name of the view to render, options in object form {key : value})
})

app.get('/contact', (request, response) => {
    response.render('contact', {title: "Contact Us"})  // (Name of the view to render, options in object form {key : value})
})

app.get('/order', (request, response) => {
    response.render('order', {title: "Order"})  // (Name of the view to render, options in object form {key : value})
})

app.get('/confirmation', (request, response) => {
    response.render('order', {title: "Order"})  // (Name of the view to render, options in object form {key : value})
})

app.post('/contact', urlencodedParser, (req, res) =>
{
    if (req.body.name == null || req.body.username == null || req.body.message == null ||
        req.body.name === "" || req.body.username === "" || req.body.message === "") {
        res.render('contact', {
            title: "Contact Us",
            message: "Please fill in all fields!"
        })
    } else if (! isValidEmail(req.body.username)) {
        res.render('contact', {
            title: "Contact Us",
            message: "Please use a valid email!"
        })
    } else {
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: pass
            }
        });

        var mailOptions = {
            from: req.body.username,
            to: user,
            subject: 'Contact Us Message',
            text: "From: " + req.body.username + "\nName: " + req.body.name + "\nMessage: " + req.body.message,
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
                res.render('contact', {
                    title: "Contact Us",
                    message: "There was an issue sending your message. Try again."
                })
            } else {
                console.log('Email sent: ' + info.response);
                res.render('contact', {
                    title: "Contact Us",
                    message: "Mail Sent!"
                })
            }
        });
    }
})

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'LemonadeStand',
    //connectionLimit: 10, // Adjust as needed
});

// Handle form submission
app.post('/order', (req, res) => {
    if (req.body.name === '' || req.body.username === '' || req.body.juice === 'Choose a juice...' ||
        req.body.sweetener === 'Choose a sweetener...' || req.body.quantity === 'Choose how many you would like...') {
        res.render('order', {
            title: "Order",
            message: "Please fill in all fields!"
        })
    } else if (! isValidEmail(req.body.username)) {
        res.render('contact', {
            title: "Contact Us",
            message: "Please use a valid email!"
        })
    } else {
        const name = req.body.name;
        const email = req.body.username;
        const juice = req.body.juice;
        const sweetener = req.body.sweetener;
        const quantity = req.body.quantity;
        const comments = req.body.message;

        // Execute the prepared statement
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error establishing a database connection:', err);
                return res.status(500).send('Error submitting the order');
            }

            connection.execute(
                'INSERT INTO lemonadestand.orders (Name, Username, Juice, Sweetener, Quantity) VALUES (?, ?, ?, ?, ?)',
                [name, email, juice, sweetener, quantity],
                (error, results) => {
                    connection.release();

                    if (error) {
                        console.error('Error inserting into the database:', error);
                        res.status(500).send('Error submitting the order');
                    } else {
                        let orderNum = results.insertId;

                        var transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: user,
                                pass: pass
                            }
                        });

                        var mailOptions = {
                            from: req.body.username,
                            to: user,
                            subject: 'New Order {ORDER NUMBER: ' + orderNum + '}',
                            text: "New Order:\nJuice: " + juice + "\nSweetener: " + sweetener + "\nAmount: " + quantity + "\nFrom: " +
                                email + "\nName: " + name + "\nMessage: " + comments,
                        };

                        transporter.sendMail(mailOptions, function(error, info){
                            if (error) {
                                console.log(error);
                            } else {
                                console.log('Email sent: ' + info.response);
                            }
                        });

                        console.log('Order inserted into the database');

                        showOrder(res, orderNum)
                    }
                }
            );
        });
    }
});

function showOrder(res, orderNum) {
    pool.query('SELECT * FROM orders WHERE OrderNum = ?', [orderNum], (error, results) => {
        if (error) {
            console.error('Error executing the query:', error);
            // Handle the error accordingly
        } else {
            // Process the query results
            const orders = results;

            // Do something with the retrieved order information
            let name
            let email
            let juice
            let sweetener
            let quantity

            for (const order of orders) {
                console.log('Order ID:', order.OrderNum);
                console.log('Name:', order.Name);
                console.log('Email:', order.Username);
                console.log('Juice:', order.Juice);
                console.log('Sweetener:', order.Sweetener);
                console.log('Quantity:', order.Quantity);
                name = order.Name
                email = order.Username
                juice = order.Juice
                sweetener = order.Sweetener
                quantity = order.Quantity
            }

            res.render('confirmation', {
                title: "Order Confirmation",
                message: "Your Order:",
                orderId: orderNum,
                name: name,
                email: email,
                juice: juice,
                sweetener: sweetener,
                quantity: quantity
            })
        }
    });
}

// No route yet (404)
app.get('*', (req, res) => {res.end("404")})


// Get the server running
const server = app.listen(8080)