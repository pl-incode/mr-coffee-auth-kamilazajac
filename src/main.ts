import express from 'express';
import { engine } from 'express-handlebars';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mrcoffee',
  password: '1',
  port: 5432,
});

interface User {
  id: number;
  firstName: string;
  lastName: string;
  password: string;
  email: string;
}

type AuthToken = { [key: string]: User };

const port = 8080;
const app = express();
const authTokens: AuthToken = {};

app.use(bodyParser.urlencoded({ extended: false }));

app.use(cookieParser());

app.set('view engine', 'hbs');
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
  })
);
interface MyUserRequest extends express.Request {
  user?: User;
}

app.use(
  (req: MyUserRequest, res: express.Response, next: express.NextFunction) => {
    const authToken = req.cookies['AuthToken'];
    req.user = authTokens[authToken];

    next();
  }
);

app.get('/', function (req, res) {
  res.render('home');
});

app.get('/register', (req, res) => {
  res.render('registration');
});

app.post('/register', async (req, res) => {
  const { email, firstName, lastName, password, confirmPassword } = req.body;

  const users = (await pool.query(`SELECT * FROM users;`)).rows;

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
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = getHashedPassword(password);
  const users = (await pool.query(`SELECT * FROM users;`)).rows;
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
});

app.get('/mainpage', async (req: MyUserRequest, res) => {
  if (!req.user) {
    res.render('login', {
      message: 'Please login to continue',
      messageClass: 'alert-danger',
    });
    return;
  }
  const schedule = (
    await pool.query(
      `SELECT users.id as user_id, firstname, day, start_at, end_at FROM users JOIN schedules ON (users.id=user_id);`
    )
  ).rows;
  res.render('mainpage', {
    Title: 'This is schedule for: ',
    schedules: schedule,
  });
});

app.get('/userPage/:id', async (req: MyUserRequest, res) => {
  if (!req.user) {
    res.render('login', {
      message: 'Please login to continue',
      messageClass: 'alert-danger',
    });
    return;
  }
  const id = req.params.id;
  const scheduleUser = (
    await pool.query(`SELECT * FROM schedules WHERE user_id=${id};`)
  ).rows;
  res.render('userPage', {
    Title: 'This is schedule for you: ',
    schedules: scheduleUser,
  });
});

app.get('/newSchedule', async (req: MyUserRequest, res) => {
  if (!req.user) {
    res.render('login', {
      message: 'Please login to continue',
      messageClass: 'alert-danger',
    });
    return;
  }
  const userId = req.user.id;
  const firstname = req.user.firstName;
  const schedule = (
    await pool.query(`SELECT * FROM schedules WHERE (user_id='${userId}');`)
  ).rows;
  res.render('newSchedule', {
    Title: `This is schedule for you: `,
    schedules: schedule,
  });
});

app.post('/newSchedule', async (req, res) => {
  pool.query(`INSERT INTO schedules (user_id, day, start_at, end_at) VALUES 
    ('${req.body.user_id}', '${req.body.day}', '${req.body.start_at}', '${req.body.end_at}');`);
  res.render('newSchedule');
});

app.get('/logout', async (req, res) => {
  const users = (await pool.query(`SELECT * FROM users;`)).rows;
  res.clearCookie('AuthToken', authTokens);
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});

const getHashedPassword = (password: string) => {
  const sha256 = crypto.createHash('sha256');
  return sha256.update(password).digest('base64');
};

const generateAuthToken = () => {
  return crypto.randomBytes(30).toString('hex');
};
