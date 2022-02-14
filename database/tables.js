//All the database tables will be defined here

//JavaScript code should be executed in "strict mode"
'use strict'

const index = require('../index.js');
//Import sequelize client
const sequelizeClient = index.sequelizeClient;
const Sequelize = index.Sequelize;

//Store users info
const usersInfoTable = sequelizeClient.define('usersInfo', {
	//For now just let user set one metamask per account
	discordUserId: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
	metamaskAddress: { type: Sequelize.STRING, allowNull: false, defaultValue: "" },
	verificationCompleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: 0 },
	processStartedTime: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
	secretKey: { type: Sequelize.STRING, allowNull: false, defaultValue: "" },
});

//Create all the tables if tables do not exist
//Call it at the last after all the tables are defined
sequelizeClient.sync()
	//sequelizeClient.sync({force: true}) //Drops table and recreates all tables
	.then(() => {
		//All success
		console.log("All the tables are good and created if does not exits.");
		//Return a non-undefined value to signal that we didn't forget to return
		return null;
	})
	.catch(err => {
		console.log(err)
		console.log("An error occur while creating table.");
	});

//********** export all the modules ********//
module.exports = {
	usersInfoTable: usersInfoTable,
};
