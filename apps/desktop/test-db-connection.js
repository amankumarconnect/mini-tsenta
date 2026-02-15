const { Pool } = require('pg')

const connectionString = 'postgresql://postgres:Nothing1234@localhost:5432/mini_tsenta'
console.log('Testing connection to:', connectionString)

const pool = new Pool({ connectionString })

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection Error:', err)
  } else {
    console.log('Connection Success:', res.rows[0])
  }
  pool.end()
})
