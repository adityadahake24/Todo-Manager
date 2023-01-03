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

  test("User A shouldn't able to update User B's todos", async () => {
    //creating user A account
    //let agent = request.agent(server);
    let result = await agent.get("/signup");
    let csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "king",
      lastName: "kong",
      email: "kingkong@gmail.com",
      password: "iamthebeast1",
      _csrf: csrfToken,
    });
    //create todo
    result = await agent.get("/todo");
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "meet friend",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const UserATodoId = result.id;
    //logout the above user
    await agent.get("/signout");
    //create another user account
    result = await agent.get("/signup");
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "pink",
      lastName: "Panther",
      email: "pinkpanther1@gmail.com",
      password: "ilikepinkpanther",
      _csrf: csrfToken,
    });
    // //create a todo,
    // result = await agent.get("/todos");
    // csrfToken = extractCsrfToken(result);
    // result= await agent.post("/todos").send({
    //   title: "take rest",
    //   dueDate: new Date().toISOString(),
    //   completed: false,
    //   _csrf: csrfToken,
    // });
    //Try to update UserA from UserB
    result = await agent.get("/todo");
    csrfToken = extractCsrfToken(result);
    const markCompleteResponse = await agent.put(`/todos/${UserATodoId}`).send({
      _csrf: csrfToken,
      completed: true,
    });
    expect(markCompleteResponse.statusCode).toBe(422);
    //Try marking incomplete
    result = await agent.get("/todo");
    csrfToken = extractCsrfToken(result);
    const markInCompleteResponse = await agent
      .put(`/todos/${UserATodoId}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      });
    expect(markInCompleteResponse.statusCode).toBe(422);
  });

   test("One user shouldn't be able delete other's todos", async () => {
    //creating user A account
    const agent = request.agent(server);
    let result = await agent.get("/signup");
    let csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "Queen",
      lastName: "Elzabeth2",
      email: "QueenElizabeth2@gmail.com",
      password: "080922",
      _csrf: csrfToken,
    });
    //create todo
    result = await agent.get("/todo");
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "rule world",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    console.log("User 1 created todo completionstatus", result);
    const UserATodoId = result.id;
    //logout userA
    await agent.get("/signout");
    //create userB account
    result = await agent.get("/signup");
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/users").send({
      firstName: "phills",
      lastName: "dr",
      email: "drphills@gmail.com",
      password: "drphills0",
      _csrf: csrfToken,
    });
    //create a todo
    result = await agent.get("/todo");
    csrfToken = extractCsrfToken(result);
    result = await agent.post("/todos").send({
      title: "learn react",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    const UserBTodoId = result.id;
    //Try to delete userA todo from userB
    result = await agent.get("/todo");
    csrfToken = extractCsrfToken(result);
    let deleteTodoResponse = await agent.delete(`/todos/${UserATodoId}`).send({
      _csrf: csrfToken,
    });
    expect(deleteTodoResponse.statusCode).toBe(422);
    //Try to delete userB todo from userA
    await login(agent, "QueenElizabeth2@gmail.com", "080922");
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