CREATE TABLE "cars" (
	"id" serial PRIMARY KEY NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"year" integer NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
