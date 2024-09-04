const express = require('express');
const app = express();
const bcryptjs = require('bcryptjs');
const Admin_Regi_Model = require('../Marriage_Certificate/Models/Admin_Regi_Model');
const db = require('../Marriage_Certificate/db');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs/promises');

const path = require('path');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const New_Registration_Model = require('./Models/New_Registration_Model');


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));
app.use(bodyParser.json());

app.use(session({
    secret: 'your_secret_key', // Replace with your own secret key
    resave: false,
    saveUninitialized: true,
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});

app.set('view engine', 'ejs');


app.get('/Admin_Registration', (req, res) => {
    res.render('../Marriage_Certificate/Views/Registration');
});

app.post('/Admin_Registration', async (req, res) => {
    try {
        const data = req.body;
        const UserEmail = await Admin_Regi_Model.findOne({ Email: data.Email });
        
        if (UserEmail) {
            req.flash('error', 'Email already exists');
            res.redirect('/Admin_Registration');
        } else {
            const NewAdminModel = new Admin_Regi_Model(data);
            await NewAdminModel.save();
            const token = NewAdminModel.GenerateJWT();
            console.log("This is registration token: " + token);
            res.redirect(`/Admin_Dashboard/${NewAdminModel._id}`);
        }
    } catch (error) {
        res.status(500).send('Internal Error');
    }
});

app.get('/Admin_Login', (req, res) => {
    res.render('../Marriage_Certificate/Views/Login');
});

app.post('/Admin_Login', async (req, res) => {
    try {
        const { Email, Password } = req.body;
        const Login_User_Email = await Admin_Regi_Model.findOne({ Email });

        if (Login_User_Email) {
            const MatchPassword = await bcryptjs.compare(Password, Login_User_Email.Password);
            if (MatchPassword) {
                const token = await Login_User_Email.GenerateJWT();
                console.log('Login token: ' + token);
                res.redirect(`/Admin_Dashboard/${Login_User_Email._id}`);
            } else {
                req.flash('error', 'Invalid Email or Password');
                res.redirect('/Admin_Login');
            }
        } else {
            req.flash('error', 'Email not found');
            res.redirect('/Admin_Login');
        }
    } catch (error) {
        res.status(500).send('Login error');
    }
});

app.get('/Admin_Dashboard/:AdminID', async (req, res) => {
    const admin_data = await Admin_Regi_Model.findById(req.params.AdminID).populate('Regi_Data');
    res.render('../Marriage_Certificate/Views/Dashboard', { admin_data });
});

app.get('/New_Registration/:id', (req, res) => {
    res.render('../Marriage_Certificate/Views/New_Registration_Form');
});

app.post('/New_Registration/:id', async (req, res) => {
    try {
        const NewRegiData = req.body;
        const NRD = new New_Registration_Model(NewRegiData);
        await NRD.save();

        const InterConnection = await Admin_Regi_Model.findById(req.params.id);
        InterConnection.Regi_Data.push(NRD._id);  
        await InterConnection.save();

        res.redirect(`/Admin_Dashboard/${InterConnection._id}`);
    } catch (error) {
        console.error('Error during new registration:', error);
        res.status(500).send('New Registration error');
    }
});

app.get('/Delete/:id', async (req, res) => {
    try {
        await New_Registration_Model.findByIdAndDelete(req.params.id);

        const DeleteData = await Admin_Regi_Model.findOne({ Regi_Data: req.params.id });
        res.redirect(`/Admin_Dashboard/${DeleteData._id}`);
    } catch (error) {
        res.status(500).send('Delete error');
    }
});

app.get('/Pdf/:id', async (req, res) => {
    try {
        const pdf_data = await New_Registration_Model.findById(req.params.id);

        async function CreatePdf(input, pdf_data) {
            const existingPdfBytes = await fs.readFile(input);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const form = pdfDoc.getForm();

            // Fill the PDF form with the data
            form.getTextField('Name').setText(pdf_data.Name || '');
            form.getTextField('Father_Name').setText(pdf_data.Father_Name || '');
            form.getTextField('Village').setText(pdf_data.Village || '');
            form.getTextField('PS').setText(pdf_data.PS || '');
            form.getTextField('Dist').setText(pdf_data.Dist || '');
            form.getTextField('Age').setText(pdf_data.DOB || '');
            form.getTextField('Post').setText(pdf_data.Post || '');
            form.getTextField('Pin').setText(pdf_data.Pin || '');

            form.getTextField('BName').setText(pdf_data.L_Name || '');
            form.getTextField('BFather_Name').setText(pdf_data.L_Father_Name || '');
            form.getTextField('BVillage').setText(pdf_data.L_Village || '');
            form.getTextField('BPS').setText(pdf_data.L_PS || '');
            form.getTextField('BDist').setText(pdf_data.L_Dist || '');
            form.getTextField('BAge').setText(pdf_data.L_DOB || '');
            form.getTextField('BPost').setText(pdf_data.L_Post || '');
            form.getTextField('BPin').setText(pdf_data.L_Pin || '');

            form.getTextField('MD').setText(pdf_data.MD || '');
            form.getTextField('Mohor').setText(pdf_data.Mohor || '');
            form.getTextField('Vol').setText(pdf_data.vol || '');
            form.getTextField('RD').setText(pdf_data.RD || '');
            form.getTextField('Place').setText(pdf_data.Place || '');
            form.getTextField('Page').setText(pdf_data.Page || '');

           

            // Save the modified PDF
            const pdfBytes = await pdfDoc.save();
            return pdfBytes;
        }

        const pdfBytes = await CreatePdf('./Marriage_Certificate/Pdf/Final Marriage Certificate (1).pdf', pdf_data);

        // Set the response headers to download the file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Modified_Certificate.pdf"');

        // Send the modified PDF file to the client
        res.end(pdfBytes);  // Use res.end() to send binary data

    } catch (error) {
        console.log('Error:', error);
        res.status(500).send('An error occurred while processing the PDF.');
    }
});

app.get('/Edit/:id', async (req, res) => {
    const Edit_Data = await New_Registration_Model.findById(req.params.id);
    res.render('../Marriage_Certificate/Views/Edit', { Edit_Data });
});

app.post('/Edit/:id', async (req, res) => {
    try {
        const { Name, Father_Name, Village, Post, PS, Dist, Pin, DOB, L_Name, L_Father_Name, L_Village, L_Post, L_PS, L_Dist, L_Pin, L_DOB, MD, RD, Mohor, Place, Page, vol } = req.body;

        await New_Registration_Model.findByIdAndUpdate(req.params.id, {
            Name, Father_Name, Village, Post, PS, Dist, Pin, DOB, L_Name, L_Father_Name, L_Village, L_Post, L_PS, L_Dist, L_Pin, L_DOB, MD, RD, Mohor, Place, Page, vol
        });

        const EditUser = await Admin_Regi_Model.findOne({ Regi_Data: req.params.id });
        res.redirect(`/Admin_Dashboard/${EditUser._id}`);
    } catch (error) {
        res.status(500).send('Edit error');
    }
});



app.listen(3000, () => {
    console.log("Server is connected on port" );
});