-- Banco separado só para os testes. O client.spec de @farol/db derruba tabelas,
-- então rodar a suíte contra o banco de desenvolvimento zera o seu catálogo.
-- Roda uma vez, quando o volume do Postgres é criado.
CREATE DATABASE farol_test;
