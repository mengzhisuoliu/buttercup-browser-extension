"use strict";

const React = require("react"),
    ReactDOM = require("react-dom");

const {
    Router,
    Route,
    Link,
    IndexRoute,
    hashHistory
} = require("react-router");

require("index.sass");

const App = require("./App");
const Home = require("./Home");
const AddArchive = require("./AddArchive");
const AddArchiveEntry = require("./AddArchiveEntry");
const AddLastLogin = require("./AddLastLogin");
const UnlockArchive = require("./UnlockArchive");
const NoMatch = require("./NoMatch");

ReactDOM.render((
    <Router history={hashHistory}>
        <Route path="/" component={App}>
            <IndexRoute component={Home} />
            <Route path="addArchive" component={AddArchive} />
            <Route path="/addArchive/:type" component={AddArchiveEntry} />
            <Route path="addLastLogin" component={AddLastLogin} />
            <Route path="/unlockArchive/:name" component={UnlockArchive} />
            <Route path="*" component={NoMatch} />
        </Route>
    </Router>
), document.getElementById("app"));
