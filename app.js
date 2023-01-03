/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const express = require("express");
var csrf = require("tiny-csrf");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
const path = require("path");
app.set("views", path.join(__dirname, "views"));
const todo = require("./models/todo");
const { title } = require("process");
app.use(bodyParser.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser("shh! some secret string "));
app.use(csrf("this_should_be_32_character_long", ["PUT","POST","DELETE"]));

const passport = require('passport');
const connectEnsureLogin = require('connect-ensure-login');
const session = require('express-session');
const flash = require("connect-flash");
const LocalStrategy = require('passport-local');
const bcrypt = require('bcrypt');

const saltRounds = 10;
app.set("view engine","ejs");
app.use(flash());
app.use(session({
  secret: "my-super-secret-key-644622414218453177816884",
  cookie: {
    maxAge: 24*60*60*1000 //24hrs
  }
}));

app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (request, response) {
    console.log(request.user);
    response.redirect("/todo");
  }
);

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({ where: { email: username } })
        .then(async function (user) {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Invalid Email-ID" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.use(express.static(path.join( __dirname,'public')))


app.get("/", async (request, response) => {
    response.render('index', {
      title : "Todo-Manager",
      csrfToken: request.csrfToken(),
    });
});

app.get("/todo", connectEnsureLogin.ensureLoggedIn(),async (request, response) => {
  try{
  const loggedInUser = request.user.id;
  const userName = request.user.firstName + " " + request.user.lastName;
  const overdue = await Todo.overdue(loggedInUser);
  const dueToday = await Todo.dueToday(loggedInUser);
  const dueLater = await Todo.dueLater(loggedInUser);
  const completed = await Todo.completed(loggedInUser);
  if (request.accepts("html")) {
    response.render('todo', {
      userName,
      overdue,
      dueToday,
      dueLater,
      completed,
      title : "Todo-Manager",
      csrfToken: request.csrfToken(),
    });
  } else {
    response.json({
      overdue,
      dueToday,
      dueLater,
      completed,
    });
  } 
  }catch (err) {
    console.log(err);
    return response.status(422).json(err);
    }
});

app.get("/signup", (request, response) => {
  response.render("signup", {title: "Signup", csrfToken: request.csrfToken() })
})

app.get("/todos", async function (_request, response) {
  console.log("Processing list of all Todos ...");
  // FILL IN YOUR CODE HERE
  try {
    const todos = await Todo.findAll();
    return response.send(todos);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }

  // First, we have to query our PostgerSQL database using Sequelize to get list of all Todos.
  // Then, we have to respond with all Todos, like:
  // response.send(todos)
});

app.get("/todos/:id", async function (request, response) {
  try {
    const Todo = await Todo.findByPk(request.params.id);
    return response.json(Todo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.post("/users", async (request,response) => {
  if (!request.body.firstName) {
    request.flash("error", "Enter your first name");
    return response.redirect("/signup");
  }
  if (!request.body.email) {
    request.flash("error", "Enter email ID");
    return response.redirect("/signup");
  }
  if (!request.body.password) {
    request.flash("error", "Enter your password");
    return response.redirect("/signup");
  }
  if (request.body.password < 8) {
    request.flash("error", "Minimum 8 characters required!");
    return response.redirect("/signup");
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  console.log(hashedPwd);

  try {
    const user = await User.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      response.redirect("/todo");
    });
  } catch (error) {
    request.flash(
      "error",
      "This mail already has a account, try another mail!"
    );
    return response.redirect("/signup");
  }
});

app.get("/login", (request, response) => {
  response.render("login", {title: "Login", csrfToken: request.csrfToken() });
})

app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

app.post("/session", passport.authenticate("local", {failureRedirect:"/login"}), (request, response) => {
  console.log(request.user);
  response.redirect("/todo")
})

app.post("/todos", connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  if (request.body.title.length < 5) {
    request.flash("error", "Minimum 5 characters required");
    return response.redirect("/todo");
  }
  if (!request.body.dueDate) {
    request.flash("error", "Due Date is required.");
    return response.redirect("/todo");
  }
  try {
    await Todo.addTodo({
      title: request.body.title,
      dueDate: request.body.dueDate,
      completed: false,
      userId: request.user.id
    });
    return response.redirect("/todo");
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.put("/todos/:id", connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  console.log("Mark Todo Completed:", request.params.id);
  try {
    const todo = await Todo.findByPk(request.params.id);
    const updatedTodo = await todo.setCompletionStatus(request.body.completed);
    return response.json(updatedTodo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.delete("/todos/:id", connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  console.log("delete a todo w/ ID:", request.params.id);
  if (todo) {
    try {
      const todo = await Todo.findByPk(request.params.id);
      const deletedTodo = await todo.deleteTodo(request.params.id, request.user.id);
      return response.send(deletedTodo ? true : false);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  } else return response.send(false);
});

module.exports = app;
