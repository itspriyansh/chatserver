const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
require('mongoose-type-email');

const User = new mongoose.Schema({
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        default: ''
    },
    email: {
        type: mongoose.SchemaTypes.Email,
        default: null
    },
    username: {
        type: String,
        required: true,
        validate: /^$|^\d{10}$/ 
    },
    public: {
        type: String,
        required: true
    },
    private: {
        type: String,
        required: true
    },
    n: {
        type: String,
        required: true
    }
},{
    timestamps: true
});

User.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', User);