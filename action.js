function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

var commander = {
  host: '',
  _verificationToken: '',
  logoutURL: '',
  //TODO: get fieldFinder value from localStorage and allow it to be configured
  fieldFinder: '<input name="__RequestVerificationToken" type="hidden" value="',

  constructor: function() {
    var commander = this; //TODO: This is already defined

    this.output = document.getElementById("outputElement");
    this.getToken = document.getElementById("getToken");
    this.tokenHolder = document.getElementById("tokenHolder");
    this.textHost = document.getElementById("hostTextbox");
    this.textLogout = document.getElementById("logoutTextbox");
    this.loginTable = document.getElementById("loginTable");

    if (localStorage["commanderLogins"]) {
      this.logins = JSON.parse(localStorage["commanderLogins"]);
    } else {
      this.logins = [
        ['Example User', 'Password']
      ];
    }
    this.host = localStorage["commanderHost"];
    this.textHost.value = this.host;

    this.logoutURL = localStorage["commanderLogout"];
    this.textLogout.value = this.logoutURL;

    this.getToken.onclick = function() {
      commander.getVerificationToken();
    };
    this.textHost.addEventListener("change", function() {
      if (commander.textHost.value.indexOf("://") === -1) {
        commander.textHost.value = "https://" + commander.textHost.value
      }
      commander.host = commander.textHost.value;
      localStorage["commanderHost"] = commander.host;
      commander.log('Changed Host to ' + commander.host);
      if (commander.host) {
        commander.getVerificationToken(true);
      }
    });
    this.textLogout.addEventListener("change", function() {
      if (commander.textLogout.value.indexOf("://") === -1) {
        commander.textLogout.value = "https://" + commander.textLogout.value
      }
      commander.logoutURL = commander.textLogout.value;
      localStorage["commanderLogout"] = commander.logoutURL;
      commander.log('Changed Logout to ' + commander.logoutURL);
    });
    this.buildLoginsTable();

    if (this.host) {
      this.getVerificationToken();
    }
  },

  showLoading: function(show) {
    var loading = document.getElementById("loading");
    if (show) {
      loading.className = "show";
    } else {
      loading.className = "hide";
    }
  },

  buildLoginsTable: function() {
    var loginTable = document.getElementById("loginTable");

    while (loginTable.hasChildNodes()) {
      loginTable.removeChild(loginTable.lastChild);
    }

    this.logins.forEach(function(login) {
      var username = login[0];
      var password = login[1];

      var row = loginTable.insertRow(-1);
      var usernameCell = row.insertCell(0);
      var passwordCell = row.insertCell(1);
      var actionsCell = row.insertCell(2);

      usernameCell.innerHTML = htmlEscape(username);
      passwordCell.innerHTML = htmlEscape(password.replace(/./gi, "*")); //Currently hiding Password, but this doesn't make debugging easy

      var loginButton = document.createElement("BUTTON");
      loginButton.value = 'Login';
      loginButton.className = 'login';
      loginButton.innerHTML = "Login";
      loginButton.onclick = function() {
        commander.sendRequest(username, password)
      };
      actionsCell.appendChild(loginButton);

      var deleteButton = document.createElement("BUTTON");
      deleteButton.value = 'Delete';
      deleteButton.className = 'delete';
      deleteButton.innerHTML = "X";
      deleteButton.onclick = function() {
        commander.logins.splice(commander.logins.indexOf(login), 1);
        commander.loginsChanged();
      };
      actionsCell.appendChild(deleteButton);
    });

    var row = loginTable.insertRow(-1);
    var usernameCell = row.insertCell(0);
    var passwordCell = row.insertCell(1);
    var actionsCell = row.insertCell(2);

    var newUsername = document.createElement('input');
    newUsername.type = "text";
    newUsername.className = "newField";
    usernameCell.appendChild(newUsername);
    var newPassword = document.createElement('input');
    newPassword.type = "text";
    newPassword.className = "newField";
    passwordCell.appendChild(newPassword);
    var addNew = document.createElement('input');
    addNew.type = "submit";
    addNew.value = "Create Login";
    addNew.className = "newField";
    addNew.onclick = function() {
      var user1 = newUsername.value;
      var pass1 = newPassword.value;
      commander.logins.push([user1, pass1]);
      commander.loginsChanged();
    };
    actionsCell.appendChild(addNew);

  },

  getVerificationToken: function(force) {
    return;
    var commander = this;
    if (this._verificationToken && !force) {
      commander.tokenHolder.value = commander._verificationToken;
      return;
    }
    if (!this.host) {
      commander.log("No Host");
      commander._verificationToken = "";
      commander.tokenHolder.value = commander._verificationToken;
    }
    commander.showLoading(true);
    var req = new XMLHttpRequest();
    req.open("POST", this.host, true);
    req.onload = this.onRecievedVerificationToken;
    req.onerror = function(e) {
      commander.log("Error Getting Token. Is Host Correct?");
      commander.showLoading(false);
    };
    req.send();
    commander.log("Requesting Token");
  },
  onRecievedVerificationToken: function(e) {
    var response = e.target.response;
    if (e.target.status >= 400) {
      commander.log("HTTP Error: " + e.target.status + " - " + e.target.response.substr(0, 35));
      commander._verificationToken = "";
      commander.tokenHolder.value = commander._verificationToken;
      commander.showLoading(false);
      return;
    }
    var start = response.indexOf(commander.fieldFinder) + commander.fieldFinder.length;
    var end = response.indexOf('"', start);
    commander._verificationToken = response.slice(start, end);
    commander.log("Token Received: " + commander._verificationToken.substr(0, 25));
    commander.tokenHolder.value = commander._verificationToken;
    commander.showLoading(false);
  },
  useVerificationToken: function() {
    if (!this._verificationToken) {
      getVerificationToken();
      //TODO: Yield or something here, or add a callback to continue when above finishes
    }
    if (this._verificationToken) {
      var tempVerificationToken = this._verificationToken;
      this._verificationToken = "";
      commander.tokenHolder.value = commander._verificationToken;
      return tempVerificationToken;
    }
  },

  sendRequest: function(username, password) {
    if (false && !commander._verificationToken) {
      //TODO: get the token, don't just fail
      commander.log("No Token");
      return;
    }
    commander.showLoading(true);

    var reqLogout = new XMLHttpRequest();
    reqLogout.open("GET", this.logoutURL, true);
    reqLogout.onload = function() {
      commander.sendLogin(username, password);
    };
    reqLogout.onerror = function(e) {
      commander.log("Error sending request. Is Host Correct?");
      commander.showLoading(false);
    };
    commander.log("Sending Logout");
    reqLogout.send(null);
  },
  sendLogin: function(username, password) {
    if (!commander.host) {
      commander.log("No Host");
    }
    var params = "userName=" + encodeURIComponent(username) + "&password=" + encodeURIComponent(password);
    var req = new XMLHttpRequest();
    req.open("POST", commander.host, true);
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.setRequestHeader("Content-length", params.length);
    req.onload = commander.onRequestReturn;
    req.onerror = function(e) {
      commander.log("Error sending request. Is Host Correct?");
      commander.showLoading(false);
    };
    commander.log("Sending Login");
    req.send(params);
  },

  onRequestReturn: function(e) {
    var response = e.target.response;
    if (response.indexOf('Your email or password is incorrect') >= 0) {
      commander.log("Invalid Username or Password");
    } else if (response.indexOf('Your account has been temporarily locked') >= 0) {
      commander.log("Account Temporarily Locked");
    } else {
      commander.log("Successful Login");
    }
    commander.showLoading(false);
    commander.getVerificationToken();
  },

  log: function(action) {
    var currentdate = new Date();
    var time = currentdate.getHours() + ":" + currentdate.getMinutes() + ":" + currentdate.getSeconds();
    commander.output.innerHTML += "<br>" + time + ": " + htmlEscape(action);
  },
  loginsChanged: function() {
    localStorage["commanderLogins"] = JSON.stringify(this.logins);
    commander.buildLoginsTable();
  }
}

document.addEventListener("DOMContentLoaded", function(event) {
  commander.constructor();
});
