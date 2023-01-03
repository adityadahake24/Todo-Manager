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
  try{
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

   test("One user cannot mark as complete/incomplete a todo of other user", async () => {
    //create UserA account
    let res = await agent.get("/signup");
    let csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User E",
      email: "usere@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    //create Todo from UserA account
    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const idOfTodoFromUserA = res.id;
    //Signout UserE
    await agent.get("/signout");
    //Create UserB account
    res = await agent.get("/signup");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User B",
      email: "userb@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    //Try markAsComplete on UserA Todo from UserB account
    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);
    const markCompleteResponse = await agent
      .put(`/todos/${idOfTodoFromUserA}`)
      .send({
        _csrf: csrfToken,
        completed: true,
      });
    expect(markCompleteResponse.statusCode).toBe(422);
    //Try markAsIncomplete on UserA Todo from UserB account
    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);
    const markIncompleteResponse = await agent
      .put(`/todos/${idOfTodoFromUserA}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      });
    expect(markIncompleteResponse.statusCode).toBe(422);
  });

  test("One user cannot delete todo of other user", async () => {
    //create UserA account
    let res = await agent.get("/signup");
    let csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User C",
      email: "userc@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    //create Todo from UserA account
    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const idOfTodoFromUserA = res.id;
    //Signout UserA
    await agent.get("/signout");
    //Create UserB account
    res = await agent.get("/signup");
    csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User D",
      email: "userd@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });

    //Try delete on UserA Todo from UserB account
    res = await agent.get("/todo");
    csrfToken = extractCsrfToken(res);
    const deleteResponse2 = await agent
      .delete(`/todos/${idOfTodoFromUserA}`)
      .send({
        _csrf: csrfToken,
      });
    expect(deleteResponse2.statusCode).toBe(422);
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

    let markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
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

    let markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
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