//jshint esversion:6

require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const app = express();
const MemoryStore = require("memorystore")(session);
const favicon = require("serve-favicon");
const path = require("path");
const axios = require("axios").default;
const moment = require("moment");
const date = moment().format("MMMM Do YYYY, h:mm:ss a");
const currentYearMonthDay = moment().format("YYYY-MM-DD");
const currentDayPlusOneDay = moment().add(1, "days").format("YYYY-MM-DD");
const currentYearMonthDayMinusOneDay = moment()
  .subtract(1, "days")
  .format("YYYY-MM-DD");
const isApproved = fetchApproval();

// ***************************
// API-DATABASE IMPLEMENTATION AREA

function fetchApproval() {
  const durationAgo = moment(currentDayPlusOneDay)
    .startOf("hours")
    .from(currentYearMonthDay);
  if (durationAgo === "a few seconds ago") {
    console.log("a few seconds ago");
    return false;
  } else if (durationAgo === "a day ago") {
    console.log(
      "A day has passed, will fetch GAMES results of yesterday's games"
    ); //Fetch Scores of previous games here
  } else if (durationAgo === "in a day") {
    console.log("Time Duration Check: in a day");
    console.log("Trying to fetch games for tomorrow"); //Fetch upcoming games here
    return true;
  } else {
    console.log("Duration: " + durationAgo);
    return false;
  }
}

function existanceChecker(games) {
  console.log("Existance Checker: " + games._id);
  if (games.id === null || games.id === undefined) {
    console.log("Games existed in DB: false");
    return false;
  } else {
    console.log("Games existed in DB: true");
    return true;
  }
}

//SPORTSPAGE-FEEDS
// const options = {
//   method: "GET",
//   url: "https://sportspage-feeds.p.rapidapi.com/games",
//   headers: {
//     "x-rapidapi-key": process.env.X_RAPIDAPI_SPORTSPAGE_KEY,
//     "x-rapidapi-host": "sportspage-feeds.p.rapidapi.com",
//   },
// };

// axios
//   .request(options)
//   .then(function (response) {
//     console.log(response.data);
//   })
//   .catch(function (error) {
//     console.error(error);
//   });

app.use(express.static("public"));
app.use(favicon(path.join(__dirname, "public", "img/favicon.png")));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
    secret: "mcnikko",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_PASSWORD, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set("useCreateIndex", true);
mongoose.set("useFindAndModify", false);

//Schemas
const betsSchema = new mongoose.Schema({
  date: String,
  betID: String,
  betType: String,
  stake: String,
  outcome: String,
  result: String,
});
const userSchema = new mongoose.Schema({
  fullName: String,
  username: String,
  mobileNumber: String,
  userID: Number,
  isPending: Boolean,
  password: String,
  googleId: String,
  facebookId: String,
  balance: Number,
  betItems: [betsSchema],
});
const adminSchema = new mongoose.Schema({
  //Work in progress
});
const gamesSchema = new mongoose.Schema({
  username: String,
  date: String,
  gameDetails: String,
  listOfGames: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

gamesSchema.plugin(passportLocalMongoose);
gamesSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
const Game = new mongoose.model("Game", gamesSchema);

//NBA-API GET GAMES

const options = {
  method: "GET",
  url: "https://api-nba-v1.p.rapidapi.com/games/date/" + currentDayPlusOneDay,
  headers: {
    "x-rapidapi-key": process.env.X_RAPIDAPI_NBA_API_KEY,
    "x-rapidapi-host": "api-nba-v1.p.rapidapi.com",
  },
};

let gamesArrayTomorrow = []; //To be rendered in /users
Game.find({ date: currentDayPlusOneDay }, function (err, foundGames) {
  let isExisted = false;

  if (err) {
    console.log(err);
  } else {
    if (foundGames) {
      const [game] = foundGames;
      if (game === undefined) {
        console.log("Data is empty, will fetch games for tomorrow");
      } else {
        const { _id, date, gameDetails } = game;
        isExisted = existanceChecker(_id);
        console.log("Game Date from API: " + date);
        console.log("Is time approved: " + isApproved);
        console.log("Is existed on DB: " + isExisted);
        console.log(
          "Is Games for " +
            currentYearMonthDay +
            " existed on Database: " +
            isExisted
        );
        console.log("found ID: " + _id);
        const gamesObject = JSON.parse(gameDetails);
        const gamesEntries = Object.entries(gamesObject.api.games);

        function GameDestructuredData(
          gameId,
          startTimeUTC,
          gameStatus,
          team1,
          team2,
          winner
        ) {
          this.gameId = gameId;
          this.startTimeUTC = moment(startTimeUTC).format(
            "MMMM Do YYYY, h:mm:ss a"
          );
          this.gameStatus = gameStatus;
          this.team1 = team1;
          this.team2 = team2;
          this.winner = winner;
        }
        gamesEntries.forEach((items) => {
          const [item1, item2] = items;
          const { gameId, startTimeUTC, statusGame, vTeam, hTeam } = item2;
          let game = new GameDestructuredData(
            gameId,
            startTimeUTC,
            statusGame,
            vTeam,
            hTeam,
            ""
          );
          gamesArrayTomorrow.push(game);
        });
        // console.log(
        //   "Developers Note: THE FOLLOWING DATA COMES FROM gamesArrayTomorrow, THIS WILL SHOW TOMORROWS GAMES:"
        // );
        // console.log(gamesArrayTomorrow); //Log to see arranged Game Data
        // console.log(
        //   "Number of Games for Tomorrow: " + gamesArrayTomorrow.length
        // );
      }
      console.log("isApproved: " + isApproved);
      console.log("isExisted: " + isExisted);
      //Will fetch if condition met
      if (isApproved && isExisted === false) {
        axios
          .request(options)
          .then(function (response) {
            console.log(
              "Developers Note: THE FOLLOWING DATA COMES NBA-API, THIS WILL BE SAVED ON Atlas mongoDB gamesSchema"
            );
            console.log(response.data);
            console.log(response.data.api.games);
            Game.findOrCreate(
              { username: currentDayPlusOneDay },
              {
                date: currentDayPlusOneDay,
                gameDetails: JSON.stringify(response.data),
                listOfGames: "",
              },
              function (err) {
                console.log(err);
              }
            );
          })
          .catch(function (error) {
            console.error(error);
          });
      } else {
        console.log(
          "Developers Note: Did not fetch Data from API! " +
            " Games for " +
            currentDayPlusOneDay +
            " already saved. " +
            "\n" +
            "To avoid multiple fetching, " +
            "Data can be retrieved on database instead!"
        );
      }
    }
  }
});

//Null checker if gamesArrayTomorrow
if (gamesArrayTomorrow === null) {
  console.log("gamesArrayTomorrow is null");
  //Will get data to gamesArrayTomorrow
  Game.find({ date: currentDayPlusOneDay }, function (err, foundGames) {
    if (err) {
      console.log(err);
    } else {
      if (foundGames) {
        const [game] = foundGames;
        const { _id, date, gameDetails } = game;
        const gamesObject = JSON.parse(gameDetails);
        const gamesEntries = Object.entries(gamesObject.api.games);
        function GameDestructuredData(
          gameId,
          startTimeUTC,
          gameStatus,
          team1,
          team2,
          winner
        ) {
          this.gameId = gameId;
          this.startTimeUTC = moment(startTimeUTC).format(
            "MMMM Do YYYY, h:mm:ss a"
          );
          this.gameStatus = gameStatus;
          this.team1 = team1;
          this.team2 = team2;
          this.winner = winner;
        }
        gamesEntries.forEach((items) => {
          const [item1, item2] = items;
          const { gameId, startTimeUTC, statusGame, vTeam, hTeam } = item2;

          let awayTeam = parseInt(Object.values(vTeam.score));
          let homeTeam = parseInt(Object.values(hTeam.score));

          // Checks Winner
          let winner;
          if (awayTeam > homeTeam) {
            winner = "Team 1";
          }

          if (awayTeam < homeTeam) {
            winner = "Team 2";
          }

          let game = new GameDestructuredData(
            gameId,
            startTimeUTC,
            statusGame,
            vTeam,
            hTeam,
            winner
          );
          gamesArrayTomorrow.push(game);
        });
        // console.log(
        //   "Developers Note: THE FOLLOWING DATA COMES FROM gamesArrayTomorrow, THIS WILL SHOW TOMORROWS GAMES:"
        // );
        // console.log(gamesArrayTomorrow); //Log to see arranged Game Data
        // console.log("Number of Games for Today: " + gamesArrayTomorrow.length);
      }
    }
  });
} else {
  console.log("gamesArrayTomorrow is not null");
}

//Check Results of Previous Games
const gameUpdate = {
  method: "GET",
  url: "",
  headers: {
    "x-rapidapi-key": process.env.X_RAPIDAPI_NBA_API_KEY,
    "x-rapidapi-host": "api-nba-v1.p.rapidapi.com",
  },
};

//END NBA-API

//ODDS-API

const api_key = process.env.ODDS_API;

Game.find({ date: currentYearMonthDay }, function (err, data) {
  const [game] = data;
  const { _id, date, gameDetails, listOfGames } = game;
  //If list of games is empty, it will fetch from ODDS-API
  if (listOfGames === null) {
    axios
      .get("https://api.the-odds-api.com/v3/odds/", {
        params: {
          api_key: api_key,
          sport: "basketball_nba",
          region: "us",
          mkt: "h2h",
          oddsFormat: "decimal",
          dateFormat: "iso",
        },
      })
      .then((response) => {
        console.log(`Successfully got ${response.data.data.length} sports.`);
        console.log(response.data.data);
        Game.findOneAndUpdate(
          { date: currentYearMonthDay },
          {
            listOfGames: JSON.stringify(response.data.data),
          },
          function (err, foundGames) {
            if (err) {
              console.log(err);
            } else {
              if (foundGames) {
                console.log(
                  "Updated Games for " +
                    currentYearMonthDay +
                    " with Odds from ODDS-API"
                );
                console.log(foundGames);
              }
            }
          }
        );
        console.log(
          "Remaining requests",
          response.headers["x-requests-remaining"]
        );
        console.log("Used requests", response.headers["x-requests-used"]);
      })
      .catch((error) => {
        console.log("Error status", error.response.status);
        console.log(error.response.data);
      });
  } else {
    console.log(
      "DID NOT FETCH FROM ODDS-API -" +
        "listOfGames for today " +
        currentYearMonthDay +
        " is already saved"
    );
  }
});

//END OF ODDS-API

//GET GAMES FOR TODAY FROM DB AND STORE IN ARRAY gamesArrayToday
let gamesArrayToday = [];
Game.find({ date: currentYearMonthDay }, function (err, foundGames) {
  if (err) {
    console.log(err);
  } else {
    if (foundGames) {
      const [game] = foundGames;
      const { _id, date, gameDetails } = game;
      const gamesObject = JSON.parse(gameDetails);
      const gamesEntries = Object.entries(gamesObject.api.games);
      function GameDestructuredData(
        gameId,
        startTimeUTC,
        gameStatus,
        team1,
        oddsAway,
        team2,
        oddsHome,
        winner
      ) {
        this.gameId = gameId;
        this.startTimeUTC = moment(startTimeUTC).format(
          "MMMM Do YYYY, h:mm:ss a"
        );
        this.gameStatus = gameStatus;
        this.team1 = team1;
        this.oddsAway = oddsAway;
        this.team2 = team2;
        this.oddsHome = oddsHome;
        this.winner = winner;
      }
      gamesEntries.forEach((items) => {
        const [item1, item2] = items;
        const { gameId, startTimeUTC, statusGame, vTeam, hTeam } = item2;

        let awayTeam = parseInt(Object.values(vTeam.score));
        let homeTeam = parseInt(Object.values(hTeam.score));

        // Checks Winner
        let winner;
        if (awayTeam > homeTeam) {
          winner = "Team 1";
        }

        if (awayTeam < homeTeam) {
          winner = "Team 2";
        }

        let game = new GameDestructuredData(
          gameId,
          startTimeUTC,
          statusGame,
          vTeam,
          "",
          hTeam,
          "",
          winner
        );
        gamesArrayToday.push(game);
      });
      console.log(
        "Developers Note: THE FOLLOWING DATA COMES FROM gamesArrayToday THIS WILL SHOW TODAYS GAMES:"
      );
      console.log(gamesArrayToday); //Log to see arranged Game Data
      console.log("Number of Games for Today: " + gamesArrayToday.length);
    }
  }
});

//GET ODDS FOR TODAY FROM DB AND STORE IN ARRAY oddsToday
let oddsToday = [];
Game.find({ date: currentYearMonthDay }, function (err, foundGames) {
  if (err) {
    console.log(err);
  } else {
    if (foundGames) {
      const [game] = foundGames;
      const { listOfGames } = game;
      const listOfGamesJSON = JSON.parse(listOfGames);
      function GameOdds(homeTeam, awayOdds, homeOdds) {
        this.homeTeam = homeTeam;
        this.awayOdds = awayOdds;
        this.homeOdds = homeOdds;
      }
      listOfGamesJSON.forEach((item) => {
        console.log(item);
        item.sites.map((items) => {
          if (items.site_key === "williamhill_us") {
            let extractedOdds = new GameOdds(
              item.home_team,
              items.odds.h2h[0],
              items.odds.h2h[1]
            );
            oddsToday.push(extractedOdds);
          }
        });
      });
      console.log(oddsToday);

      // THIS AREA IS STILL UNDERCONSTRUCTION
      //Merging of Odds for today and Games for today
      oddsToday.map((item) => {
        // console.log("From Odds: " + item.homeTeam);
        gamesArrayToday.map((items) => {
          const { team2 } = items;
          const { fullName } = team2;
          // console.log("From Games: " + fullName);
          if (item.homeTeam === fullName) {
            // Problem with spelling (looking for a way to merge without conflicts)
          }
        });
      });
    }
  }
});

//GET GAMES FOR YESTERDAY FROM DB AND STORE IN ARRAY gamesArrayYesterday
let gamesArrayYesterday = [];
Game.find({ date: currentYearMonthDayMinusOneDay }, function (err, foundGames) {
  if (err) {
    console.log(err);
  } else {
    if (foundGames) {
      const [game] = foundGames;
      const { _id, date, gameDetails } = game;
      const gamesObject = JSON.parse(gameDetails);
      const gamesEntries = Object.entries(gamesObject.api.games);
      function GameDestructuredData(
        gameId,
        startTimeUTC,
        gameStatus,
        team1,
        team2,
        winner
      ) {
        this.gameId = gameId;
        this.startTimeUTC = moment(startTimeUTC).format(
          "MMMM Do YYYY, h:mm:ss a"
        );
        this.gameStatus = gameStatus;
        this.team1 = team1;
        this.team2 = team2;
        this.winner = winner;
      }
      gamesEntries.forEach((items) => {
        const [item1, item2] = items;
        const { gameId, startTimeUTC, statusGame, vTeam, hTeam } = item2;

        let awayTeam = parseInt(Object.values(vTeam.score));
        let homeTeam = parseInt(Object.values(hTeam.score));

        // Checks Winner
        let winner;
        if (awayTeam > homeTeam) {
          winner = "Team 1";
        }

        if (awayTeam < homeTeam) {
          winner = "Team 2";
        }

        let game = new GameDestructuredData(
          gameId,
          startTimeUTC,
          statusGame,
          vTeam,
          hTeam,
          winner
        );
        gamesArrayYesterday.push(game);
      });
      // console.log(
      //   "Developers Note: THE FOLLOWING DATA COMES FROM gamesArrayYesterday, THIS WILL SHOW YESTERDAYS GAMES:"
      // );
      // console.log(gamesArrayYesterday); //Log to see arranged Game Data
      // console.log(
      //   "Number of Games for Yesterday: " + gamesArrayYesterday.length
      // );
    }
  }
});

// ***************************
// USER-ADMIN IMPLEMENTATION AREA

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID_G,
      clientSecret: process.env.CLIENT_SECRET_G,
      callbackURL: "http://localhost:3000/auth/google/user",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      console.log(profile._json.email);
      User.findOrCreate(
        {
          googleId: profile.id,
        },
        {
          username: profile._json.email,
          fullName: profile.displayName,
          balance: 0,
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.CLIENT_ID_FB,
      clientSecret: process.env.CLIENT_SECRET_FB,
      callbackURL: "http://localhost:3000/auth/facebook/user",
      enableProof: true,
      profileFields: [
        "id",
        "email",
        "gender",
        "link",
        "locale",
        "name",
        "timezone",
        "updated_time",
        "verified",
      ],
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate(
        { facebookId: profile.id },
        {
          username: profile._json.email,
          fullName: `${profile.name.givenName} ${profile.name.familyName}`,
          balance: 0,
        },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get("/", (req, res) => {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/user",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/user");
  }
);

app.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

app.get(
  "/auth/facebook/user",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/user");
  }
);

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

let isAdmin = false;
app.get("/admin", (req, res) => {
  if (isAdmin === true) {
    User.find(function (err, foundUsers) {
      if (err) {
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("admin", { allUsers: foundUsers });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

//Deposit (NOW FOR ADMIN)
app.post("/deposit/:id", (req, res) => {
  const amountToDeposit = req.body.deposit;

  User.findById(req.params.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.balance += parseFloat(amountToDeposit);
        foundUser.save(function () {
          res.redirect("/admin");
        });
      }
    }
  });
});

//Withdraw (NOW FOR ADMIN)
app.post("/withdraw/:id", (req, res) => {
  const amountToWithdraw = req.body.withdraw;

  User.findById(req.params.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.balance -= parseFloat(amountToWithdraw);
        if (foundUser.balance <= 0) {
          foundUser.balance = 0;
        }
        foundUser.save(function () {
          res.redirect("/admin");
        });
      }
    }
  });
});

//Send (NOW FOR ADMIN)
app.post("/send/:id/:balance", (req, res) => {
  const amountToSend = req.body.amountToSend;
  const receiver = req.body.receiver;
  const currentUserID = req.params.id;
  const currentUserBalance = req.params.balance;

  if (currentUserBalance >= amountToSend) {
    updateCurrentUserBalance();
  } else {
    console.log("Insufficient Balance");
    res.redirect("/admin");
  }

  function updateCurrentUserBalance() {
    User.findById(currentUserID, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          sendMoney();
          foundUser.balance -= parseFloat(amountToSend);
          foundUser.save(function () {
            res.redirect("/admin");
          });
        }
      }
    });
  }

  function sendMoney() {
    User.findOne({ username: receiver }, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.balance += parseFloat(amountToSend);
          foundUser.save();
        }
      }
    });
  }
});
//END of Send

app.get("/user", function (req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          console.log(foundUser);
          res.render("user", {
            fullname: foundUser.fullName,
            username: foundUser.username,
            balance: foundUser.balance.toFixed(2),
            dateTomorrow: currentDayPlusOneDay,
            dateToday: currentYearMonthDay,
            dateYesterday: currentYearMonthDayMinusOneDay,
            gamesTomorrow: gamesArrayTomorrow,
            gamesToday: gamesArrayToday,
            gamesYesterday: gamesArrayYesterday,
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/register", function (req, res) {
  User.register(
    { fullName: req.body.fullname, username: req.body.username, balance: 0 },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/user");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.email,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local", {})(req, res, function () {
        if (req.body.username === "manager@ghailsportsbetting.com") {
          isAdmin = true;
          res.redirect("/admin");
        } else {
          res.redirect("/user");
        }
      });
    }
  });
});

app.get("/refresh/:date", function (req, res) {
  console.log(req.params.date);
  const dateToRefresh = req.params.date;
  const options = {
    method: "GET",
    url: "https://api-nba-v1.p.rapidapi.com/games/date/" + dateToRefresh,
    headers: {
      "x-rapidapi-key": process.env.X_RAPIDAPI_NBA_API_KEY,
      "x-rapidapi-host": "api-nba-v1.p.rapidapi.com",
    },
  };

  axios
    .request(options)
    .then(function (response) {
      console.log(
        "Developers Note: THE FOLLOWING DATA COMES NBA-API, THIS WILL REFRESH DATABASE DATA " +
          dateToRefresh +
          " ON MONGODB DATABASE."
      );
      Game.findOneAndUpdate(
        { date: req.params.date },
        {
          username: req.params.date,
          gameDetails: JSON.stringify(response.data),
        },
        function (err, foundGames) {
          if (err) {
            console.log(err);
          } else {
            if (foundGames) {
              console.log(foundGames);
              console.log(gamesArrayYesterday);
            }
          }
        }
      );
    })
    .catch(function (error) {
      console.error(error);
    });

  res.redirect("/user");
});

app.get("/logout", function (req, res) {
  isAdmin = false;
  req.logout();
  res.redirect("/");
});

app.get("/delete/:id", function (req, res) {
  User.findByIdAndDelete(req.params.id, function (err) {
    if (err) console.log(err);
    console.log("Successfully deleted: " + req.params.id);
  });
  res.redirect("/admin");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, () => {
  console.log("Server started! on " + port);
});
