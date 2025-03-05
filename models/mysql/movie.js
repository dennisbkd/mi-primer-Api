/* eslint-disable camelcase */
import mysql from 'mysql2/promise'

const config = {
  host: 'localhost',
  user: 'root',
  port: 3306,
  password: 'root',
  database: 'moviesdb'
}

const connection = await mysql.createConnection(config)

export class MovieModel {
  static async getAll ({ genre }) {
    if (genre) {
      /* const lowerCaseGenre = genre.toLowerCase()
      const [genres] = await connection.query('Select id, name from genre where lower(name)=?;', [lowerCaseGenre])

      if (genres.length === 0) return []

      const [{ id }] = genres

      const [moviesGenre] = await connection.query('SELECT DISTINCT movie_id,genre_id FROM movie_genres INNER JOIN genre  ON movie_genres.genre_id =?;', [id])
      const movieIds = moviesGenre.map(movie => movie.movie_id)

      const placeholders = movieIds.map(() => '?').join(',')
      const [resultMovieGenre] = await connection.query(`SELECT title, year, director, duration, poster, rate, BIN_TO_UUID(id) id FROM movie WHERE movie.id IN (${placeholders});`, movieIds)
      return resultMovieGenre */

      const lowerCaseGenre = genre.toLowerCase()
      const [moviesGenre] = await connection.query(`
          SELECT 
              m.title, m.year, m.director, m.duration, m.poster, m.rate, BIN_TO_UUID(m.id) as id 
          FROM 
              movie m
          JOIN 
              movie_genres mg ON m.id = mg.movie_id
          JOIN 
              genre g ON mg.genre_id = g.id
          WHERE 
              LOWER(g.name) = ?;
      `, [lowerCaseGenre])

      return moviesGenre
    }
    const [movies] = await connection.query(
      'SELECT title, year , director, duration, poster, rate, BIN_TO_UUID(id) id FROM movie;'
    )
    return movies
  }

  static async getById ({ id }) {
    const [movies] = await connection.query(
      'SELECT title, year , director, duration, poster, rate, BIN_TO_UUID(id) id FROM movie WHERE id = UUID_TO_BIN(?);', [id]
    )
    if (movies.length === 0) return null
    return movies[0]
  }

  static async create ({ input }) {
    const {
      genre: genreInput,
      title,
      year,
      duration,
      director,
      rate,
      poster
    } = input

    const [uuidResult] = await connection.query('SELECT UUID() uuid;')
    const [{ uuid }] = uuidResult
    const placeholders = genreInput.map(() => '(?)').join(',')

    try {
      await connection.query(
        `INSERT INTO movie (id, title, year, director, duration, poster, rate)
          VALUES (UUID_TO_BIN("${uuid}"), ?, ?, ?, ?, ?, ?);`,
        [title, year, director, duration, poster, rate]
      )
    } catch (e) {
      throw new Error('Error creating movie')
      // sendLong(e)
    }

    try {
      await connection.query(
        `INSERT IGNORE INTO genre (name) VALUES ${placeholders}`, genreInput
      )
    } catch (e) {
      throw new Error('Error creating genre')
    }

    const [genreResults] = await connection.query(
      `SELECT id FROM genre WHERE name IN (${placeholders});`, genreInput
    )
    const idsGenre = genreResults.map(genre => genre.id)

    try {
      for (const genreId of idsGenre) {
        await connection.query(
          'INSERT INTO movie_genres (movie_id, genre_id) VALUES (UUID_TO_BIN(?), ?);',
          [uuid, genreId]
        )
      }
    } catch (e) {
      throw new Error('Error in the relations to table')
    }

    const [movies] = await connection.query(
      `SELECT title, year, director, duration, poster, rate
        FROM movie WHERE id = UUID_TO_BIN(?);`,
      [uuid]
    )
    return movies[0]
  }

  static async delete ({ id }) {
    const [deleteResult] = await connection.query(
      'DELETE FROM movie WHERE id = UUID_TO_BIN(?);', [id]
    )
    if (deleteResult.length === 0) return null
    return deleteResult[0]
  }

  static async update ({ id, input }) {
    const {
      genre: genreInput,
      title,
      year,
      duration,
      director,
      rate,
      poster
    } = input
    try {
      await connection.query(
        `UPDATE movie 
         SET 
           title = COALESCE(?, title), 
           year = COALESCE(?, year), 
           director = COALESCE(?, director), 
           duration = COALESCE(?, duration), 
           poster = COALESCE(?, poster), 
           rate = COALESCE(?, rate)
         WHERE id = UUID_TO_BIN(?);`,
        [title, year, director, duration, poster, rate, id]
      )
    } catch (e) {
      throw new Error('ERROR IN THE UPDATE MOVIE')
    }

    if (genreInput !== undefined) {
      const [newGenre] = await connection.query(
        'SELECT id FROM genre  WHERE name = ?', genreInput
      )

      console.log(id)
      try {
        await connection.query(
          `UPDATE movie_genres SET movie_genres = ?
            WHERE movie_id = UUID_TO_BIN(?);`,
          [newGenre, id]
        )
      } catch (e) {

      }
    }

    try {
      const [updateMovie] = await connection.query(
        `SELECT title, year, director, duration, poster, rate
         FROM movie WHERE id = UUID_TO_BIN(?);`, [id]
      )
      return updateMovie[0]
    } catch (e) {
      throw new Error('ERROR IN THE SELECT MOVIE AFTER UPDATE')
    }
  }
}
