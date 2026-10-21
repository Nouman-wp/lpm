// The folders the Local Folder picker offers that no sample project is made
// from yet: what a visitor adopts as a brand new project.

const readme = (name: string, about: string, run: string) =>
  `# ${name}\n\n${about}\n\n## Development\n\n\`\`\`bash\n${run}\n\`\`\`\n`;

export const CLIENT_PORTAL_FILES: Record<string, string> = {
  "package.json": `{
  "name": "client-portal",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  }
}
`,
  "README.md": readme(
    "client-portal",
    "Where clients sign in to see their invoices and projects.",
    "npm install\nnpm run dev",
  ),
  "app/layout.tsx": `import { Header } from "@/components/header";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
`,
  "app/page.tsx": `export default function Home() {
  return (
    <section>
      <h1>Welcome back</h1>
      <p>Your invoices and projects, in one place.</p>
    </section>
  );
}
`,
  "app/globals.css": `body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
`,
  "components/header.tsx": `import Link from "next/link";

export function Header() {
  return (
    <header>
      <Link href="/">Client Portal</Link>
      <nav>
        <Link href="/invoices">Invoices</Link>
        <Link href="/projects">Projects</Link>
      </nav>
    </header>
  );
}
`,
};

// lpm reads Procfile.dev for a Rails app: one service per line.
export const BOOKSHELF_FILES: Record<string, string> = {
  "Gemfile": `source "https://rubygems.org"

ruby "3.4.2"

gem "rails", "~> 8.0.2"
gem "puma", ">= 5.0"
gem "sqlite3", ">= 2.1"
gem "tailwindcss-rails", "~> 4.1"
gem "sidekiq", "~> 7.3"
gem "kamal", require: false

group :development, :test do
  gem "debug"
end
`,
  "Gemfile.lock": `GEM
  remote: https://rubygems.org/
  specs:
    kamal (2.5.3)
    puma (6.6.0)
    rails (8.0.2)
    sidekiq (7.3.9)
    sqlite3 (2.6.0)
    tailwindcss-rails (4.1.0)

PLATFORMS
  arm64-darwin-24

DEPENDENCIES
  kamal
  puma (>= 5.0)
  rails (~> 8.0.2)
  sidekiq (~> 7.3)
  sqlite3 (>= 2.1)
  tailwindcss-rails (~> 4.1)

BUNDLED WITH
   2.6.2
`,
  "Procfile.dev": `web: bin/rails server -p 3000
css: bin/rails tailwindcss:watch
worker: bundle exec sidekiq
`,
  "README.md": readme(
    "bookshelf",
    "A lending library for the office: browse the shelf, borrow a book, get a reminder when it's due.",
    "bundle install\nbin/dev",
  ),
  "app/models/book.rb": `class Book < ApplicationRecord
  has_many :loans, dependent: :destroy

  validates :title, :author, presence: true

  scope :available, -> { where.not(id: Loan.open.select(:book_id)) }

  def available?
    loans.open.none?
  end
end
`,
  "app/models/loan.rb": `class Loan < ApplicationRecord
  belongs_to :book
  belongs_to :user

  scope :open, -> { where(returned_at: nil) }
  scope :overdue, -> { open.where(due_on: ...Date.current) }
end
`,
  "app/controllers/books_controller.rb": `class BooksController < ApplicationController
  def index
    @books = Book.order(:title)
  end

  def show
    @book = Book.find(params[:id])
  end
end
`,
  "bin/dev": `#!/usr/bin/env sh
exec foreman start -f Procfile.dev "$@"
`,
  "bin/rails": `#!/usr/bin/env ruby
APP_PATH = File.expand_path("../config/application", __dir__)
require_relative "../config/boot"
require "rails/commands"
`,
  "config/routes.rb": `Rails.application.routes.draw do
  resources :books, only: %i[index show] do
    resources :loans, only: %i[create update]
  end

  root "books#index"
end
`,
  "config/deploy.yml": `service: bookshelf
image: you/bookshelf

servers:
  web:
    - 192.168.0.12
  job:
    hosts:
      - 192.168.0.12
    cmd: bundle exec sidekiq

proxy:
  ssl: true
  host: books.example.com
`,
};

export const DATA_WAREHOUSE_FILES: Record<string, string> = {
  "README.md": readme(
    "data-warehouse",
    "The analytics models: staging over the raw tables, marts for revenue and retention, and the ad-hoc queries the team keeps reaching for.",
    "uv tool install dbt-postgres\ndbt build --project-dir dbt",
  ),
  "dbt/dbt_project.yml": `name: warehouse
version: "1.0.0"
profile: warehouse

model-paths: ["models"]
test-paths: ["tests"]

models:
  warehouse:
    staging:
      +materialized: view
    marts:
      +materialized: table
`,
  "dbt/models/staging/schema.yml": `version: 2

models:
  - name: stg_orders
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests: [not_null]
      - name: status
        tests:
          - accepted_values:
              values: [pending, paid, refunded]
  - name: stg_customers
    columns:
      - name: customer_id
        tests: [unique, not_null]
      - name: email
        tests: [unique, not_null]
`,
  "dbt/models/staging/stg_orders.sql": `select
  id as order_id,
  customer_id,
  amount_cents / 100.0 as amount,
  status,
  created_at
from {{ source('app', 'orders') }}
where status <> 'test'
`,
  "dbt/models/staging/stg_customers.sql": `select
  id as customer_id,
  lower(email) as email,
  plan,
  created_at
from {{ source('app', 'customers') }}
`,
  "dbt/models/marts/fct_revenue.sql": `select
  date_trunc('month', o.created_at) as month,
  c.plan,
  count(distinct o.customer_id) as paying_customers,
  sum(o.amount) as revenue
from {{ ref('stg_orders') }} o
join {{ ref('stg_customers') }} c using (customer_id)
where o.status = 'paid'
group by 1, 2
`,
  "queries/weekly_active_users.sql": `select
  date_trunc('week', occurred_at) as week,
  count(distinct user_id) as active_users
from events
where occurred_at > now() - interval '12 weeks'
group by 1
order by 1;
`,
  "queries/churn_by_plan.sql": `select
  plan,
  count(*) filter (where canceled_at is not null) * 1.0 / count(*) as churn_rate
from subscriptions
group by plan
order by churn_rate desc;
`,
};
