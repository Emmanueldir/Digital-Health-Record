# Authentication API

## Login

`POST /api/auth/login`

Request body:

```json
{
  "email": "doctor@example.com",
  "password": "password",
  "role": "Doctor"
}
```

`role` is validated against the roles assigned to the user account. For backward compatibility, the role can be omitted only when the user has exactly one assigned role.

Successful response:

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "<jwt>",
  "user": {
    "id": 1,
    "email": "doctor@example.com",
    "role": "Doctor"
  }
}
```

The response also includes `token` as a temporary backward-compatible alias for `accessToken`.

Failed responses:

- `400` when required fields are missing or role input is malformed.
- `401` when email or password is invalid.
- `403` when the account is inactive, has no assigned roles, or is not authorized for the requested role.

JWT payload:

```json
{
  "sub": "1",
  "email": "doctor@example.com",
  "role": "Doctor",
  "permissions": ["view_patient"],
  "iat": 1710000000,
  "exp": 1710086400
}
```
