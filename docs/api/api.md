# 03 API Contract

Base URL: `http://localhost:8000/api`

## Auth
- `POST /auth/register` `{email,password,displayName}`
- `POST /auth/login` `{email,password}`
- `GET /auth/me`
- `POST /auth/logout`
- `PATCH /users/me`
- `PATCH /users/me/password`
- `DELETE /users/me`

## Images
- `POST /images/upload` multipart `image`
- `GET /images`
- `GET /images/:id`
- `DELETE /images/:id`

## Puzzles
- `POST /puzzles/generate` `{imageId,title,rows,columns,difficulty,pieceShape}`
- `GET /puzzles`
- `GET /puzzles/recent`
- `GET /puzzles/:id`
- `GET /puzzles/:id/status`
- `GET /puzzles/:id/download`
- `DELETE /puzzles/:id`

## Progress
- `GET /puzzles/:id/progress`
- `PUT /puzzles/:id/progress`
- `POST /puzzles/:id/progress/autosave`
