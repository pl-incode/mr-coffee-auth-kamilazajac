'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = __importDefault(require('express'));
const express_handlebars_1 = require('express-handlebars');
const cookie_parser_1 = __importDefault(require('cookie-parser'));
const body_parser_1 = __importDefault(require('body-parser'));
const crypto_1 = __importDefault(require('crypto'));
const pg_1 = require('pg');
// const Pool = PG.Pool;
const pool = new pg_1.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mrcoffee',
  password: '1',
  port: 5432,
});
const port = 8080;
const app = (0, express_1.default)();
const authTokens = {};
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use((0, cookie_parser_1.default)());
app.set('view engine', 'hbs');
app.engine(
  'hbs',
  (0, express_handlebars_1.engine)({
    extname: '.hbs',
  })
);
app.use((req, res, next) => {
  const authToken = req.cookies['AuthToken'];
  req.user = authTokens[authToken];
  next();
});
app.get('/', function (req, res) {
  res.render('home');
});
app.get('/register', (req, res) => {
  res.render('registration');
});
app.post('/register', (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    const { email, firstName, lastName, password, confirmPassword } = req.body;
    const users = (yield pool.query(`SELECT * FROM users;`)).rows;
    if (users.find((user) => user.email === email)) {
      res.render('registration', {
        message: 'User already registered.',
        messageClass: 'alert-danger',
      });
      return;
    }
    if (password !== confirmPassword) {
      res.render('registration', {
        message: 'Password does not match.',
        messageClass: 'alert-danger',
      });
      return;
    }
    const hashedPassword = getHashedPassword(password);
    pool.query(`INSERT INTO users (firstname, lastname, email, password) VALUES 
    ('${req.body.firstname}', '${req.body.lastname}', '${req.body.email}', '${hashedPassword}');`);
    res.render('login', {
      message: 'Registration Complete. Please login to continue.',
      messageClass: 'alert-success',
    });
  })
);
app.get('/login', (req, res) => {
  res.render('login');
});
app.post('/login', (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    const hashedPassword = getHashedPassword(password);
    const users = (yield pool.query(`SELECT * FROM users;`)).rows;
    const user = users.find((u) => {
      return u.email === email && u.password === hashedPassword;
    });
    if (!user) {
      res.render('login', {
        message: 'Invalid username or password',
        messageClass: 'alert-danger',
      });
      return;
    }
    const authToken = generateAuthToken();
    authTokens[authToken] = user;
    res.cookie('AuthToken', authToken);
    res.redirect('/mainpage');
  })
);
app.get('/mainpage', (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
      res.render('login', {
        message: 'Please login to continue',
        messageClass: 'alert-danger',
      });
      return;
    }
    const schedule = (yield pool.query(
      `SELECT users.id as user_id, firstname, day, start_at, end_at FROM users JOIN schedules ON (users.id=user_id);`
    )).rows;
    res.render('mainpage', {
      Title: 'This is schedule for: ',
      schedules: schedule,
    });
  })
);
app.get('/userPage/:id', (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
      res.render('login', {
        message: 'Please login to continue',
        messageClass: 'alert-danger',
      });
      return;
    }
    const id = req.params.id;
    const scheduleUser = (yield pool.query(
      `SELECT * FROM schedules WHERE user_id=${id};`
    )).rows;
    res.render('userPage', {
      Title: 'This is schedule for you: ',
      schedules: scheduleUser,
    });
  })
);
app.get('/newSchedule', (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
      res.render('login', {
        message: 'Please login to continue',
        messageClass: 'alert-danger',
      });
      return;
    }
    const userId = req.user.id;
    const firstname = req.user.firstName;
    const schedule = (yield pool.query(
      `SELECT * FROM schedules WHERE (user_id='${userId}');`
    )).rows;
    res.render('newSchedule', {
      Title: `This is schedule for you: `,
      schedules: schedule,
    });
  })
);
app.post('/newSchedule', (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    pool.query(`INSERT INTO schedules (user_id, day, start_at, end_at) VALUES 
    ('${req.body.user_id}', '${req.body.day}', '${req.body.start_at}', '${req.body.end_at}');`);
    res.render('newSchedule');
    // pool.query(`SELECT * FROM schedules WHERE user_id=req.body.user_id
    // ('${req.body.user_id}', '${req.body.day}', '${req.body.start_at}', '${req.body.end_at}');`)
  })
);
app.get('/logout', (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    const users = (yield pool.query(`SELECT * FROM users;`)).rows;
    res.clearCookie('AuthToken', authTokens);
    res.redirect('/');
  })
);
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
const getHashedPassword = (password) => {
  const sha256 = crypto_1.default.createHash('sha256');
  return sha256.update(password).digest('base64');
};
const generateAuthToken = () => {
  return crypto_1.default.randomBytes(30).toString('hex');
};
