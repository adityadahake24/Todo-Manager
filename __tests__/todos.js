/* eslint-disable no-undef */
const request = require("supertest");
var cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Todo test suite ", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User A",
      email: "user.a@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign out", async () => {
    let res = await agent.get("/todo");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todo");
    expect(res.statusCode).toBe(302);
  });

  test("User1 shouldn't able to update User2's todos", async () => {
    //creating user A account
    //let agent = request.agent(server);
    let result = await agent.get("/signup");
    let csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "UpdateTest",
      lastName: "User1",
      email: "user1@update.com",
      password: "updateuser123",
      _csrf: csrfToken,
    });

    result = await agent.get("/todo"); //creating todo
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "Visit Bank",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const UserATodoId = result.id;
    await agent.get("/signout"); //logging out of above user
    result = await agent.get("/signup"); // creating another new user to test
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "UpdateTest",
      lastName: "user2",
      email: "user2@update.com",
      password: "updateuser123",
      _csrf: csrfToken,
    });

    result = await agent.get("/todo"); //Trying to update user 1 todo from User 2 as completed
    csrfToken = extractCsrfToken(result);
    const markCompleteResponse = await agent.put(`/todos/${UserATodoId}`).send({
      _csrf: csrfToken,
      completed: true,
    });
    expect(markCompleteResponse.statusCode).toBe(422);

    result = await agent.get("/todo"); //Trying to update user 1 todo from User 2 as incompleted
    csrfToken = extractCsrfToken(result);
    const markInCompleteResponse = await agent
      .put(`/todos/${UserATodoId}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      });
    expect(markInCompleteResponse.statusCode).toBe(422);
  });

  test("User3 shouldn't be able delete User4's todo", async () => {
    const agent = request.agent(server); // Signup with new account
    let result = await agent.get("/signup");
    let csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "UpdateTest",
      lastName: "User3",
      email: "user3@update.com",
      password: "deletetodo123",
      _csrf: csrfToken,
    });

    result = await agent.get("/todo"); // posting a new todo
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "Take bruno for a walk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    console.log("User 1 created todo completionstatus", result);
    const UserATodoId = result.id;

    await agent.get("/signout"); // signout of user3

    result = await agent.get("/signup"); // create user4
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "UpdateTest",
      lastName: "User4",
      email: "user4@update.com",
      password: "deletetodo123",
      _csrf: csrfToken,
    });

    result = await agent.get("/todo"); //creating a todo
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "learn react",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const UserBTodoId = result.id;

    result = await agent.get("/todo"); //trying to delete user3 todo from user4
    csrfToken = extractCsrfToken(result);
    let deleteTodoResponse = await agent.delete(`/todos/${UserATodoId}`).send({
      _csrf: csrfToken,
    });
    expect(deleteTodoResponse.statusCode).toBe(422);
    //Try to delete user4 todo from user3
    await login(agent, "user3@update.com", "deletetodo123");
    result = await agent.get("/todo");
    csrfToken = extractCsrfToken(result);
    deleteTodoResponse = await agent.delete(`/todos/${UserBTodoId}`).send({
      _csrf: csrfToken,
    });
    expect(deleteTodoResponse.statusCode).toBe(422);
  });

  test("Creates a todo and responds with json at /todos POST endpoint", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    const res = await agent.get("/todo");
    const csrfToken = extractCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "Go to movie",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Update a todo with given ID as complete", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/todo");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Pay OTT Bill",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todo")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.dueToday.length;
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1];

    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);

    let markCompleteResponse = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
      completed: true,
    });

    let parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(true);
  });

  test("Update a todo with given ID as incomplete", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/todo");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Buy chips",
      dueDate: new Date().toISOString(),
      completed: true,
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todo")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.dueToday.length;
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1];

    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);

    let markCompleteResponse = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
      completed: false,
    });

    let parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(false);
  });

  test("Deletes a todo with the given ID if it exists and sends a boolean response", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    let res = await agent.get("/todo");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Get milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const gropuedTodosResponse = await agent
      .get("/todo")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(gropuedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.dueToday.length;
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1];

    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);

    const response = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
    });
    const parsedUpdateResponse = JSON.parse(response.text);
    expect(parsedUpdateResponse.completed).toBe(false);
  });
});
