# Development Notes

## Releasing a New Version

To release a new version, follow these steps:

### Production Release

```
# Make sure you're on main branch
git checkout main
git tag v1.0.0
git push origin v1.0.0
```

### Feature Release

```
# Make sure you're on a feature branch
git checkout feature-x
git tag v1.0.0-beta1
git push origin v1.0.0-beta1
```