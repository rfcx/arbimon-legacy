

Examples of users model usage

```

Users.findByUsername("rafa", function(err, rows) {
    console.log(rows);
});


var user = {
    id: 2,
    password: sha256('1234')
}

Users.update(user, function(err, rows) {
    console.dir(rows);
});

var user = {
    firstname: 'juan',
    lastname: 'del pueblo',
    email: 'juanito@gmail.com',
    login: 'juan123',
    password: sha256('1234')
}

Users.insert(user, function(err, rows) {
    console.log(err);
    console.dir(rows);
});


```
