# Pricing Assumptions

This project is a simplified AWS cost estimator for learning and portfolio use.
Every rate below is a **curated sample assumption**. Rates are **not fetched
live** and are **not an official AWS quote**. Real bills vary by region,
operating system, usage model, taxes, free-tier credits, data transfer,
snapshots, monitoring, commitment discounts, and other services.

## Regions and currency

The catalogue covers four representative regions and bills in USD:

- `us-east-1` - US East (N. Virginia)
- `us-west-2` - US West (Oregon)
- `ap-southeast-2` - Asia Pacific (Sydney)
- `eu-west-1` - Europe (Ireland)

To stay honest and maintainable, each region is the us-east-1 reference table
scaled by a transparent per-region factor rather than independently sourced
numbers:

| Region | Factor (sample) |
| --- | --- |
| US East (N. Virginia) | 1.00 |
| US West (Oregon) | 1.00 |
| Asia Pacific (Sydney) | 1.27 |
| Europe (Ireland) | 1.08 |

All rates are editable in the UI, so you can override any assumption for a
specific region, OS, or pricing model within the planner guardrails below.

## Planner guardrails

The calculator applies finite application-level caps to every numeric field.
They are intentionally much higher than the included presets and protect saved,
imported, and shared estimates from accidental extreme values. They are **not**
AWS service limits.

| Input | Maximum |
| --- | ---: |
| Monthly budget | $10,000,000 |
| Planning horizon / monthly growth / contingency reserve | 60 months / 20% per month / 50% of modeled cost |
| Estimate owner / cost centre / review note | 80 / 60 / 1,000 characters |
| EC2 instances / monthly runtime / hourly rate | 1,000 / 744 hours / $10 |
| EBS volumes / GB per volume / GB-month rate | 100 / 16,384 GB / $10 |
| S3 storage / storage rate / monthly requests / request rate per 1,000 | 1,000,000 GB / $10 / 10,000,000,000 / $1 |
| RDS instances / monthly runtime / instance rate | 100 / 744 hours / $10 |
| RDS storage / storage rate | 16,384 GB / $10 |
| Outbound data transfer / rate | 1,000,000 GB / $10 |
| Other AWS services allowance | $1,000,000 / month |

## Planning assumptions

The planning forecast begins with the current calculated monthly total and
compounds only the monthly growth percentage entered in the workspace. Month 1
is the current estimate; later months use:

`month n = current monthly total x (1 + monthly growth / 100)^(n - 1)`

This is a transparent what-if projection, not an AWS pricing forecast or a
prediction of consumption. The horizon is deliberately bounded to 60 months and
the monthly growth assumption to 20% so corrupted imported/shared state cannot
produce impractical values.

The optional contingency reserve is a percentage applied to modeled service
costs before budget, allocation, forecast, and export calculations. It is a
visible planning buffer for uncertainty; it is not an AWS line item, discount,
tax, or quote. Keep it at 0% when you do not intend to budget a reserve.

## Commitment and rate-sensitivity assumptions

EC2 compute and RDS instance cost can optionally include a user-entered blended
commitment what-if. The model keeps gross cost, commitment saving, and net cost
separate:

`modeled saving = eligible gross cost x coverage percentage x covered-cost discount percentage`

Coverage is bounded from 0-100%; the discount applied to covered cost is bounded
from 0-80%. These are planning inputs only: the app does not validate AWS
eligibility, fetch terms, recommend a purchase, or present the result as a
quote. EBS, S3, data transfer, and manual allowances are not commitment-eligible
in this model.

The optional rate-sensitivity field applies the same bounded percentage above
and below the commitment-adjusted monthly plan. It produces low, base, and high
cases and a corresponding forecast stress view; it does not change the bundled
sample rates or predict a future AWS price.

## Reference rates (us-east-1, factor 1.0)

### EC2 compute (Linux/Unix, on-demand, USD/hour)

| Instance | Sample rate |
| --- | ---: |
| t3.nano | 0.0052 |
| t3.micro | 0.0104 |
| t3.small | 0.0208 |
| t3.medium | 0.0416 |
| t3.large | 0.0832 |
| m5.large | 0.096 |
| c5.large | 0.085 |

Cost model: `quantity × monthly hours × hourly rate`. A rough always-on month is
730 hours; the runtime presets are development (40h), part-time (160h), business
hours (260h), and always-on (730h).

### EBS storage (USD/GB-month)

| Volume type | Sample rate |
| --- | ---: |
| gp3 | 0.08 |
| gp2 | 0.10 |
| io2 | 0.125 |
| st1 | 0.045 |
| sc1 | 0.015 |

Cost model: `volumes × storage-per-volume (GB) × GB-month rate`. Provisioned IOPS
and throughput charges are not modelled.

### S3 object storage

| Storage class | Sample rate (USD/GB-month) |
| --- | ---: |
| S3 Standard | 0.023 |
| S3 Standard-IA | 0.0125 |
| S3 One Zone-IA | 0.01 |
| S3 Glacier Instant Retrieval | 0.004 |

Requests use a single blended sample rate of `0.0004` USD per 1,000 requests.
Cost model: `GB × GB-month rate` plus `requests / 1000 × request rate`. Real S3
prices GET, PUT, and other request types separately, and adds retrieval and
lifecycle-transition charges that are not modelled here.

### RDS database

| Instance class | Sample rate (USD/hour) |
| --- | ---: |
| db.t3.micro | 0.017 |
| db.t3.small | 0.034 |
| db.t3.medium | 0.068 |
| db.m5.large | 0.171 |

Database storage uses a sample rate of `0.115` USD/GB-month. Cost model:
`quantity × hours × instance rate` plus `storage GB × storage rate`. The engine
profile is informational. Excluded: backups, snapshots, Multi-AZ duplication,
provisioned I/O, data transfer, and commercial-engine licensing.

### Outbound data transfer

A flat sample rate of `0.09` USD/GB for internet egress. Cost model:
`outbound GB × per-GB rate`. Real AWS transfer pricing is tiered and depends on
destination and service; inbound and in-region transfer are excluded.

### Other AWS services allowance

The optional **Other AWS services** section accepts a label and a manually
entered monthly amount. Its cost model is simply `monthly allowance`. It exists
to make an incomplete model visible: use it for a researched placeholder such
as monitoring, backups, NAT gateways, support, or another service not otherwise
represented in the planner. It is not a generated rate and must not be treated
as an AWS quote.

## What is intentionally excluded

Free-tier credits, taxes, Savings Plans / Reserved Instance discounts, load
balancers, NAT gateways, CloudWatch monitoring, support plans, and any service
not listed above. The optional manual allowance can make a specific omission
visible, but this tool still estimates a simplified subset to build intuition,
not to reproduce an AWS invoice.
