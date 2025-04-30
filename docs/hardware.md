# Server Hardware

Choosing the right hardware is essential for smoothly and efficiently running your self-hosted applications. Below are easy-to-understand recommendations to help you select hardware that meets your current needs and provides room for future expansion.

## Recommended Specs

### CPU (Processor)

A processor with **4 to 8 cores** is typically sufficient for most home setups. More cores generally mean better multitasking and smoother performance when running multiple applications. Since our self-host server will be running 24/7, it makes sense to look for CPU options that offer **low-power consumption** (25W or less).

### RAM (Memory)

A minimum of **8GB** should be enough to handle basic self-hosted applications for everyday usage. However, **16GB** or **32GB** is ideal for future-proofing, especially if you anticipate using multiple applications or memory intensive features (e.g. full-text search for documents in NextCloud).

### Storage Capacity

Your storage needs will depend greatly on how you plan to use your setup. The recommended minimum is 2TB, which is usually adequate for a server storing family documents, photos videos and other personal data. To future-proof your self-host setup, consider buying hardware that supports future storage expansion with additional NVMe or SATA slots. This will allow you to increase storage capacity as your needs grow over time.

## Server Workshop Hardware

With the considerations above in mind, the hardware we will use for the server workshop uses the following components:

* Case: [NucBox G3 Plus](https://www.gmktec.com/products/nucbox-g3-plus-enhanced-performance-mini-pc-with-intel-n150-processor) which includes an Intel N150 processor. The N150 has 4 cores which provides sufficient capacity for running multiple applications on our server, while consuming low power consumption (30W peak).
* RAM: [Crucial 16GB DDR4](https://www.amazon.com/dp/B08C511GQH) provides sufficient memory to power even the more advanced features in NextCloud and Immich, such as free-text search, image tagging, etc.
* Storage: [WD 2TB Green NVMe](https://www.amazon.com/dp/B09DVRBNWV) should be sufficient for most family servers. The NucBox G3 case comes with 1 additional SSD expansion slot which allows growing the server storage capacity up to 4TB in the future.