const express = require('express')
const app = express();

require('dotenv').config();
const flash = require('connect-flash');
const session = require('express-session');
const bcryptjs = require('bcryptjs');
app.set('view engine', 'ejs');
const User_Model = require('./Models/User_Model');
const Dawat_Model = require('./Models/Dawat_Model')

const db = require('./DB');
const path = require('path');
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'Public')));

const bodyParser = require('body-parser');
const { now } = require('mongoose');

app.use(bodyParser.json());

const moment = require('moment');
const { userInfo } = require('os');


app.use(session({
  secret: 'your_secret_key', // Replace with your own secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));



app.use(flash());

app.use((req, res, next) => { res.locals.messages = req.flash(); next(); });


const auth = (req, res, next) => {

  if (!req.session.userId) {
    return res.redirect('/MMR-User-Login')
  };
  next();
}


app.get('/Logout', function (req, res) {

  req.session.destroy(() => {

    return res.redirect('/MMR-User-Login')
  })
})



app.get('/MMR-User-Signup', function (req, res) {
  res.render('../Views/User_Signup');
})

app.post('/MMR-User-Signup', async function (req, res) {

  try {

    const userData = req.body;
    const userEmail = await User_Model.findOne({ Email: userData.Email });
    const userMobile = await User_Model.findOne({ Mobile: userData.Mobile });

    if (userEmail) {
      req.flash('error', 'Email already exist ');
      return res.redirect('/MMR-User-Signup');
    }

    else if (userMobile) {
      req.flash('error', 'Mobile number already exist ');
      return res.redirect('/MMR-User-Signup');
    }

    else if (userData.Mobile.length !== 10) {
      req.flash('error', 'Mobile number must be within 10 charecters ');
      return res.redirect('/MMR-User-Signup');
    }

    const New_User_Model = new User_Model(userData);
    await New_User_Model.save();
    const token = await New_User_Model.GenerateJWT();

    req.session.userId = New_User_Model._id;
    console.log('This is signup token', token)
    res.redirect('/MMR-Kazi-Office');

  }

  catch {

    console.log('This is Signup error')

  }
})

app.get('/MMR-User-Login', function (req, res) {
  res.render('../Views/User_Login');
})

app.post('/MMR-User-Login', async function (req, res) {

  const { Email, Password } = req.body;

  const userEmail = await User_Model.findOne({ Email: Email });
  if (userEmail) {
    const matchPassword = await bcryptjs.compare(Password, userEmail.Password);
    if (matchPassword) {
      const tokens = await userEmail.GenerateJWT();
      req.session.userId = userEmail._id;
      return res.redirect('/MMR-Kazi-Office')
    }

    else {
      req.flash('error', 'Incorrect Email or Password');
      return res.redirect('/MMR-User-Login')
    }
  }

  else {
    req.flash('error', 'Invalid login details');
    return res.redirect('/MMR-User-Login')
  }

})

app.get('/MMR-Kazi-Office', auth, async function (req, res) {

  const UserID = req.session.userId;
  const userData = await User_Model.findById(UserID).populate('Dawat');
  const today = moment().format('YYYY-MM-DD');
  const todayPrograme = userData.Dawat.filter(programe => programe.Date === today)

  res.render('../Views/User_Dashboard', { todayPrograme, userData });
})

app.get('/Reset-Password', function (req, res) {
  res.render('../Views/Reset_Password');
})


app.post('/Reset-Password', async function (req, res) {

  const { Email, Password } = req.body;
  const userEmailsource = await User_Model.findOne({ Email: Email });
  if (!userEmailsource) {

    req.flash('error', 'You are not aligable');
    return res.redirect('/Reset-Password')

  }

  else {

    userEmailsource.Password = Password;
    await userEmailsource.save();
    req.session.userId = userEmailsource._id;
    req.flash('success', 'Password update successfully')
    res.redirect('/MMR-User-Login')

  }

})


app.get('/MMR-Kazi-Office/Dawat-Form/:id', async function (req, res) {

  const userData = await User_Model.findById(req.params.id);

  res.render('../Views/Dawat_Form', { userData });
})


app.post('/MMR-Kazi-Office/Dawat-Form/:id', async function (req, res) {

  const dawatdat = req.body;
  const New_Dawat_Model = new Dawat_Model(dawatdat);
  await New_Dawat_Model.save();
  const connect = await User_Model.findById(req.params.id);
  connect.Dawat.push(New_Dawat_Model._id);
  await connect.save();
  req.flash('success', 'Dawat accepted successfully')
  userID = req.params.id
  res.redirect(`/MMR-Kazi-Office/All-Dawat/${connect._id}`);

})



app.get('/MMR-Kazi-Office/All-Dawat/:id', async function (req, res) {

  const userData = await User_Model.findById(req.params.id).populate('Dawat');
  // userID = req.params.id;

  res.render('../Views/All_Dawat', { userData });
})




app.get('/Delete-Dawat/:id', async function (req, res) {

  await Dawat_Model.findByIdAndDelete(req.params.id);
  req.flash('success', 'Dawat delete successfully')
  const deleteDawat = await User_Model.findOne({ Dawat: req.params.id });
  res.redirect(`/MMR-Kazi-Office/All-Dawat/${deleteDawat._id}`)
})


app.get('/Edit-Dawat/:id', async function (req, res) {

  const editDawat = await Dawat_Model.findById(req.params.id)

  res.render('../Views/Edit_Dawat_Form', { editDawat });
})

app.post('/Edit-Dawat/:id', async function (req, res) {

  const { Date, Place, Name, Mobile } = req.body;
  await Dawat_Model.findByIdAndUpdate(req.params.id, { Date, Place, Name, Mobile });

  const editDawatnama = await User_Model.findOne({ Dawat: req.params.id });
  req.flash('success', 'Dawat edit successfully')
  res.redirect(`/MMR-Kazi-Office/All-Dawat/${editDawatnama._id}`)

})



app.get('/MMR-Kazi-Office/User-Profile/:id', async function (req, res) {

  const userData = await User_Model.findById(req.params.id)

  res.render('../Views/User_Profile.ejs', { userData });
})



app.get('/Edit-User/:id', async function (req, res) {

  const userData = await User_Model.findById(req.params.id)

  res.render('../Views/Edit_User', { userData });
})



app.post('/Edit-User/:id', async function (req, res) {

  const { Name, Mobile, Email } = req.body;
  await User_Model.findByIdAndUpdate(req.params.id, { Name, Mobile, Email });
  userId = req.params.id;
  req.flash('success', 'Profile Update successfully')
  res.redirect('/MMR-Kazi-Office');
})


const PORT = process.env.PORT || 3000

app.listen(PORT, () => {

  console.log('Server is connected')
})


