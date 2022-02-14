/*
Bot: Reaper Bot
Description: Bot to connect users' discord with metamask.
Date: 02/09/2022
botScientist: rabTAI
*/
console.log(">>>>>>>>>>>>>> Index.js>>>>>>>>>>>>>>>")

'use strict'
//ENV variables
const conf = require('./config.js');
const axios = require('axios');
//Get the crypto module
var crypto = require("crypto");

const express = require('express');
const cors = require('cors');
const ethUtil = require('ethereumjs-util')
const sigUtil = require('eth-sig-util')

//********** Set up a Discord Client **********
const DiscordBot = require('discord.js');
const discordClient = new DiscordBot.Client();
discordClient.login(conf.discord.token);

//*************************** Set up a Sequelize Client ****************************
//Sequelize is a promise-based ORM for Node.js v4 and up.
//Features solid transaction support, relations, read replication and more.
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const sequelizeClient = new Sequelize(conf.sequelize.databaseName, conf.sequelize.userName, conf.sequelize.passWord, {
  host: conf.sequelize.host,
  dialect: conf.sequelize.dialect,
  //operatorsAliases:Op,
  logging: false, //logging: true, Display sql activities in console
  //This will be used as the default options for all defined models.
  define: {
    timestamps: false,// true by default
    freezeTableName: true,//don't auto plurals model(table) names
  },
  dialectOptions: {
    supportBigNumbers: true,
    bigNumberStrings: true
  }
});

var usersInfoTable;
//Check the status of sequelize
sequelizeClient
  .authenticate()
  .then(() => {
    //Once sequelize is successfully connected, import all the database tables
    const database = require('./database/tables.js');
    usersInfoTable = database.usersInfoTable;
    console.log('Sequelize Connection has been established successfully.');
  })
  .catch(err => { //If Error connecting sequelize
    console.error('Sequelize Unable to connect to the database:', err);
  });

discordClient.on('ready', async () => {
  console.log(`Discord Logged in as ${discordClient.user.tag}!`);
});

discordClient.on('error', function (err) {
  console.log("Something went wrong with Discord Client", err);
});

//********** Set up a Fantom API **********
const ftmRPC = conf.ftmRPC;
const ethers = require("ethers");
const provider = new ethers.providers.JsonRpcProvider(ftmRPC);

//Check first time if the nodes are connected
(async () => {
  try {
    //Check if the connection is established
    let blockNumber = await provider.getBlockNumber()
    console.log("Fantom network has been successfully connected, block: ", blockNumber)
  } catch (err) {
    console.log("Problem connecting Fantom node: " + err);
  }
})();

//*********** Set up express *************
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Start the server
app.listen(3842, (error) => {
  if (error) return console.log(`Error: ${error}`);
  console.log(`Express Server is listening on port 3842, but double check the code.`);
});

//This function will fire up when there is a message for the bot
discordClient.on('message', async function (msg) {
  //Don't process the message from bot itself, just ignore it
  if (msg.author === discordClient.user) {
    return;
  }
  //Ignore any other bot
  if (msg.author.bot) {
    return;
  }
  //Check if the message is started from using bot prefix
  if (msg.content.startsWith("!")) {
    //call message handler
    try {
      //None of the commands can be executed in DM so just ignore them
      if (msg.channel.type == "dm") {
        return;
      }
      //This is where all the commands happen
      let fullCommand;
      fullCommand = msg.content.substr(1);
      // Split the message up in to pieces for each space
      let splitCommand = fullCommand.split(" ");
      // The first word directly after the exclamation is the command
      let primaryCommand = splitCommand[0].toLowerCase();
      // All other words are arguments/parameters/options for the command
      let argument = splitCommand.slice(1);

      //Check if the command is right, if wrong command then return
      if (primaryCommand != "verify") {
        try {
          await msg.reply({
            embed: {
              title: `**Wrong Command**`,
              //Red color
              color: 0XFF0000,
              description: `I don't understand the command.`
            }
          });
        } catch (err) {
          console.log("can' send DM")
        }
        return;
      }

      let userExists = await usersInfoTable.findOne({ where: { discordUserId: msg.author.id } });
      //If user exist
      if (userExists) {
        //If user already verified
        if (userExists.verificationCompleted) {
          try {
            await discordClient.users.cache.get(userExists.discordUserId).send({
              embed: {
                title: `**Already Verified**`,
                //Red color
                color: 0XFF0000,
                description: `${messageSignedAddress} has been already verified.`
              }
            });
          } catch (err) {
            // console.log("Can't send DM to user.")
          }
        } else {
          let verificationTime = Date.now() - userExists.processStartedTime;
          //Check if the verification started time is more than 2 minutes
          if (verificationTime < 120000) {//120000
            //Send message to user
            try {
              await discordClient.users.cache.get(userExists.discordUserId).send({
                embed: {
                  title: `**Verification Process**`,
                  //Red color
                  color: 0XFF0000,
                  description: `Verification is in process, just wait for it to be completed.`
                }
              });
            } catch (err) {
              // console.log("Can't send DM to user.")
            }
            return;
          }
          //User exits but hasn't verified yet
          //Need to add users wallet address and other info
          await verifyUserMetamask(msg);
        }
      } else {
        //If user does not exist then create a record
        await usersInfoTable.findOrCreate({
          where: { discordUserId: msg.author.id }, defaults: {
            discordUserId: msg.author.id,
          }
        });
        //Verify user
        await verifyUserMetamask(msg);
      }
    } catch (err) {
      console.log("Error calling message Listener from Discord handler: " + err)
    }
  }
});


async function verifyUserMetamask(msg) {
  //Create a new secret key (CryptoHash) and send to the front end (link)
  var secretKey = crypto.randomBytes(20).toString('hex');
  secretKey = "ReaperBot" + secretKey;

  messageDesc = `Click the link to verify your Metamask address.\nIf you don't verify within 2 minutes, this link will be invalid.`;


  let verifyLink = `https://yourserver.com/?code=${secretKey}`

  try {
    await discordClient.users.cache.get(msg.author.id).send({
      embed: {
        title: `**Verify Address**`,
        //Red color
        color: 0XFF0000,
        description: `${messageDesc}\n[Click here](${verifyLink})`
      }
    });
  } catch (err) {
    // console.log("Can't send DM to user.")
  }


  //Add that secret key to user's database
  await usersInfoTable.update({ 'secretKey': secretKey }, { where: { discordUserId: msg.author.id } });
  //Time Started
  await usersInfoTable.update({ 'processStartedTime': (Date.now().toString()) }, { where: { discordUserId: msg.author.id } });

  let userInfo;

  //Run every 30 seconds to check if the user is verified or not or time is up
  const verifyTimer = setInterval(async () => {
    // console.log("timer is running")
    //Check if user is verified
    userInfo = await usersInfoTable.findOne({ where: { discordUserId: msg.author.id } });

    //If there was an issue creating an account, then it won't return anything
    //If user Exist
    if (userInfo) {
      if (userInfo.verificationCompleted) {
        //Disable the button
        //Stop the timer
        clearTimeout(verifyTimer);
        // console.log("timer stopped, already verified")
        //Return so process cancel does not get executed
        return;
      }

      //Check if the verification started time is more than 2 minutes or user already verified
      if ((Date.now() - (userInfo.processStartedTime)) > 120000) {
        //Stop the timer
        clearTimeout(verifyTimer);
        try {
          await discordClient.users.cache.get(userInfo.discordUserId).send({
            embed: {
              title: `**Process Canceled**`,
              //Red color
              color: 0XFF0000,
              description: `You did not response within 2 minutes, process canceled.`
            }
          });
        } catch (err) {
          // console.log("Can't send DM to user.")
        }
      }
    }
  }, 30000);
}

//When user signs the message
app.post('/verifyAddress', async (req, res) => {
  const {
    account, // The address the user is claiming to be
    code, // The original raw code sent from Discord
    message // the signed message we will use to verify
  } = (req.body)
  // recover the address that actually signed this message
  const messageSignedAddress = sigUtil.recoverPersonalSignature({
    data: ethUtil.bufferToHex(Buffer.from(code, 'utf8')),
    sig: message
  });
  //Need to check if the user that singed the message is the same address that said the address was used to sign
  if (account !== messageSignedAddress) {
    console.log("Verify: Signed message address and user address do not match.")
    return res.json({ verified: false });
  }
  //Get user's discord ID using the secret code
  let userInfo = await usersInfoTable.findOne({ where: { secretKey: code } });
  //Check if user exist, because if someone tries to verify by someone else link 
  if (!userInfo) {
    return res.json({ verified: false });
  }
  //Check if code is expired or not
  let verificationTime = Date.now() - userInfo.processStartedTime;
  //Check if the verification started time is more than 2 minutes
  if (verificationTime > 120000) {//120000
    //Send message back to server
    return res.json({ verified: false });
  }
  //Check if the user already had the address
  if (userInfo.metamaskAddress == "") {
    //First time
    // console.log("user verified")
    await usersInfoTable.update({ 'verificationCompleted': 1 }, { where: { discordUserId: userInfo.discordUserId } })
    try {
      await discordClient.users.cache.get(userInfo.discordUserId).send({
        embed: {
          title: `**Successfully Verified**`,
          //Red color
          color: 0XFF0000,
          description: `${messageSignedAddress} has been successfully verified.`
        }
      });
    } catch (err) {
      // console.log("Can't send DM to user.")
    }
    //Update the time so after successful the code will be invalid
    await usersInfoTable.decrement({ 'processStartedTime': 120000 }, { where: { discordUserId: userInfo.discordUserId } });
    //send the response back to server
    return res.json({ verified: true });
  } else {
    //Send user a message in discord
    try {
      await discordClient.users.cache.get(userInfo.discordUserId).send({
        embed: {
          title: `**Already Verified**`,
          //Red color
          color: 0XFF0000,
          description: `${messageSignedAddress} is already verified.`
        }
      });
    } catch (err) {
      // console.log("Can't send DM to user.")
    }
    return res.json({ verified: false });
  }
});


//Returns all the functions
module.exports = {
  sequelizeClient: sequelizeClient,
  Sequelize: Sequelize
}